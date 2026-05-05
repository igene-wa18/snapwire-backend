import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { SendMessageSchema, EditMessageSchema } from '../utils/validation.js';
import { createValidationError } from '../utils/errors.js';
import * as messageService from '../services/messageService.js';
import * as chatService from '../services/chatService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/messages/chat/:chatId
 * Get paginated messages for a chat (cursor-based)
 */
router.get(
  '/messages/chat/:chatId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { chatId } = req.params;
    const before = (req.query.before as string) || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const messages = await messageService.getMessages(chatId, req.user.userId, before, limit);

    res.json({
      success: true,
      data: {
        messages,
        limit,
        hasMore: messages.length === limit,
      },
    });
  })
);

/**
 * POST /api/messages/chat/:chatId
 * Send a new message
 */
router.post(
  '/messages/chat/:chatId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { chatId } = req.params;
    const { content, type, replyTo, media } = req.body;

    if (type === 'text' && !content) {
      throw createValidationError('Content is required for text messages');
    }

    const message = await messageService.createMessage(
      chatId,
      req.user.userId,
      content,
      type || 'text',
      replyTo,
      media
    );

    // Update the last message in the chat (denormalized for performance)
    await chatService.updateLastMessage(
      chatId,
      message._id.toString(),
      content || '',
      req.user.userId,
      type || 'text',
      message.createdAt
    );

    // Increment unread counts for other participants
    await chatService.incrementUnreadForAll(chatId, req.user.userId);

    // Broadcast via Socket.IO to all users in the chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit('message:new', {
        ...message.toObject(),
        chatId,
      });
    }

    res.status(201).json({
      success: true,
      data: { message },
    });
  })
);

/**
 * PATCH /api/messages/:id/read
 * Mark a single message as read
 */
router.patch(
  '/messages/:id/read',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const message = await messageService.markMessageRead(req.params.id, req.user.userId);

    res.json({
      success: true,
      data: { message },
    });
  })
);

/**
 * PATCH /api/messages/read-multiple
 * Mark multiple messages as read
 */
router.patch(
  '/messages/read-multiple',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { chatId, messageIds } = req.body;

    if (!chatId || !messageIds || !Array.isArray(messageIds)) {
      throw createValidationError('chatId and messageIds array are required');
    }

    const messages = await messageService.markMessagesRead(messageIds, req.user.userId);

    // Reset unread count for this chat
    await chatService.resetUnreadCount(chatId, req.user.userId);

    res.json({
      success: true,
      data: { messages },
    });
  })
);

/**
 * PATCH /api/messages/:id
 * Edit a message
 */
router.patch(
  '/messages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const result = EditMessageSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const message = await messageService.editMessage(req.params.id, req.user.userId, result.data.content);

    res.json({
      success: true,
      data: { message },
    });
  })
);

/**
 * DELETE /api/messages/:id
 * Delete a message (for you or everyone)
 */
router.delete(
  '/messages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const { deleteForEveryone } = req.body || {};
    let message;

    if (deleteForEveryone) {
      message = await messageService.deleteMessageForEveryone(req.params.id, req.user.userId);
    } else {
      message = await messageService.deleteMessageForUser(req.params.id, req.user.userId);
    }

    res.json({
      success: true,
      data: { message },
    });
  })
);

export default router;
