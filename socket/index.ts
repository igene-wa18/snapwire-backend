import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { getEnvConfig } from '../utils/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import * as userService from '../services/userService.js';
import * as messageService from '../services/messageService.js';
import * as chatService from '../services/chatService.js';
import { registerGroupEvents } from './groupEvents.js';

const config = getEnvConfig();

/**
 * Extended Socket type with user authentication info
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

/**
 * Initialize Socket.io server with JWT authentication and all event handlers
 */
export function initializeSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.SOCKET_IO_CORS_ORIGIN.split(',').map(o => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─────────────────────────────────────────────────────────────────────
  // JWT AUTH MIDDLEWARE
  // ─────────────────────────────────────────────────────────────────────

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);
      socket.userId = payload.userId;
      socket.email = payload.email;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // CONNECTION HANDLER
  // ─────────────────────────────────────────────────────────────────────

  io.on('connection', async (socket: AuthenticatedSocket) => {
    if (!socket.userId) return;

    console.log(`✓ User ${socket.userId} connected via Socket.io`);

    // Join personal room for targeted events
    socket.join(`user:${socket.userId}`);

    // Mark user as online
    await userService.updatePresence(socket.userId, true);

    // Broadcast online status to all connected users
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      isOnline: true,
    });

    // ─────────────────────────────────────────────────────────────────
    // CHAT ROOM EVENTS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Join a chat room to receive real-time messages
     */
    socket.on('chat:join', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.join(`chat:${data.chatId}`);
        console.log(`  → User ${socket.userId} joined chat:${data.chatId}`);
      }
    });

    /**
     * Leave a chat room
     */
    socket.on('chat:leave', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.leave(`chat:${data.chatId}`);
        console.log(`  ← User ${socket.userId} left chat:${data.chatId}`);
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // MESSAGE EVENTS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Send a message via Socket.io (real-time path)
     */
    socket.on('message:send', async (data: {
      chatId: string;
      content?: string;
      type?: string;
      replyTo?: string;
      tempId: string;
    }) => {
      try {
        const { chatId, content, type, replyTo, tempId } = data;

        if (!chatId || (!content && type === 'text')) {
          socket.emit('error', {
            code: 'VALIDATION_ERROR',
            message: 'chatId and content are required',
          });
          return;
        }

        // Create the message
        const message = await messageService.createMessage(
          chatId,
          socket.userId!,
          content,
          (type as any) || 'text',
          replyTo
        );

        // Update last message in chat
        await chatService.updateLastMessage(
          chatId,
          message._id.toString(),
          content || '',
          socket.userId!,
          type || 'text',
          message.createdAt
        );

        // Increment unread counts
        await chatService.incrementUnreadForAll(chatId, socket.userId!);

        // Emit to the chat room (including sender for confirmation)
        io.to(`chat:${chatId}`).emit('message:new', {
          ...message.toObject(),
          chatId,
          tempId,
        });

        console.log(`  ✉ Message sent in chat:${chatId} by ${socket.userId}`);
      } catch (error) {
        console.error('Error in message:send:', error);
        socket.emit('error', {
          code: 'MESSAGE_SEND_FAILED',
          message: 'Failed to send message',
        });
      }
    });

    /**
     * Mark message as delivered
     */
    socket.on('message:delivered', async (data: { messageId: string; chatId: string }) => {
      try {
        const { messageId, chatId } = data;

        const message = await messageService.markMessageDelivered(messageId, socket.userId!);

        // Notify the sender about delivery
        io.to(`chat:${chatId}`).emit('message:status_update', {
          messageId,
          chatId,
          status: 'delivered',
          deliveredTo: message.deliveredTo,
        });
      } catch (error) {
        console.error('Error in message:delivered:', error);
      }
    });

    /**
     * Mark messages as read
     */
    socket.on('message:read', async (data: { chatId: string; messageIds: string[] }) => {
      try {
        const { chatId, messageIds } = data;

        const messages = await messageService.markMessagesRead(messageIds, socket.userId!);

        // Reset unread count
        await chatService.resetUnreadCount(chatId, socket.userId!);

        // Notify chat room about read status
        io.to(`chat:${chatId}`).emit('message:status_update', {
          chatId,
          messageIds,
          status: 'read',
          readBy: { user: socket.userId, readAt: new Date() },
        });
      } catch (error) {
        console.error('Error in message:read:', error);
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // TYPING EVENTS
    // ─────────────────────────────────────────────────────────────────

    socket.on('typing:start', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('typing:indicator', {
          chatId: data.chatId,
          userId: socket.userId,
          isTyping: true,
        });
      }
    });

    socket.on('typing:stop', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('typing:indicator', {
          chatId: data.chatId,
          userId: socket.userId,
          isTyping: false,
        });
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // GROUP EVENTS
    // ─────────────────────────────────────────────────────────────────

    registerGroupEvents(io, socket);

    // ─────────────────────────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      console.log(`✗ User ${socket.userId} disconnected`);

      if (socket.userId) {
        // Mark user as offline
        await userService.updatePresence(socket.userId, false);

        // Broadcast offline status
        socket.broadcast.emit('user:offline', {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      }
    });
  });

  return io;
}
