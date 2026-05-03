import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import * as chatService from '../services/chatService.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/errors.js';
import mongoose from 'mongoose';

/**
 * Register group management events on Socket.io
 */
export function registerGroupEvents(io: Server, socket: AuthenticatedSocket) {
  if (!socket.userId) return;

  // ─────────────────────────────────────────────────────────────────────
  // GROUP CREATION
  // ─────────────────────────────────────────────────────────────────────

  socket.on('group:create', async (data: any) => {
    try {
      const { name, memberIds, groupIcon, description } = data;

      if (!name || !memberIds || memberIds.length < 1) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Group name and at least one member required',
        });
        return;
      }

      // Create group
      const chat = await chatService.createGroupChat(
        name,
        memberIds,
        socket.userId!,
        groupIcon,
        description
      );

      // Create system message
      const systemMessage = new Message({
        chat: chat._id,
        sender: null,
        type: 'system',
        content: `${(await User.findById(socket.userId))?.displayName} created the group`,
        status: 'sent',
      });
      await systemMessage.save();

      // Update last message
      await Chat.updateOne(
        { _id: chat._id },
        {
          $set: {
            'lastMessage.messageId': systemMessage._id,
            'lastMessage.content': systemMessage.content,
            'lastMessage.type': 'system',
            'lastMessage.sentAt': systemMessage.createdAt,
          },
        }
      );

      // Notify all members
      for (const memberId of chat.participants) {
        io.to(`user:${memberId}`).emit('chat:new', {
          chat: chat.toObject(),
        });
      }

      // Broadcast system message to group
      io.to(`chat:${chat._id}`).emit('group:system_message', {
        chatId: chat._id,
        content: systemMessage.content,
        type: 'system',
        createdAt: systemMessage.createdAt,
      });

      socket.emit('group:created', {
        chat: chat.toObject(),
      });

      console.log(`✓ Group ${chat._id} created by ${socket.userId}`);
    } catch (error) {
      console.error('Error in group:create:', error);
      socket.emit('error', {
        code: 'GROUP_CREATE_FAILED',
        message: 'Failed to create group',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // ADD MEMBER TO GROUP
  // ─────────────────────────────────────────────────────────────────────

  socket.on('group:add_member', async (data: { chatId: string; userId: string }) => {
    try {
      const { chatId, userId } = data;

      // Verify admin
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', {
          code: 'CHAT_NOT_FOUND',
          message: 'Chat not found',
        });
        return;
      }

      if (!chat.admins.some((admin: any) => admin.toString() === socket.userId)) {
        socket.emit('error', {
          code: 'NOT_GROUP_ADMIN',
          message: 'Only admins can add members',
        });
        return;
      }

      // Add member
      await chatService.addGroupMember(chatId, userId, socket.userId!);

      // Create system message
      const addedUser = await User.findById(userId);
      const adderUser = await User.findById(socket.userId);
      const systemMessage = new Message({
        chat: chatId,
        sender: null,
        type: 'system',
        content: `${adderUser?.displayName} added ${addedUser?.displayName}`,
        status: 'sent',
      });
      await systemMessage.save();

      // Update last message
      await Chat.updateOne(
        { _id: chatId },
        {
          $set: {
            'lastMessage.messageId': systemMessage._id,
            'lastMessage.content': systemMessage.content,
            'lastMessage.type': 'system',
            'lastMessage.sentAt': systemMessage.createdAt,
          },
        }
      );

      // Notify new member
      io.to(`user:${userId}`).emit('chat:new', {
        chat: chat.toObject(),
      });

      // Broadcast system message to group
      io.to(`chat:${chatId}`).emit('group:system_message', {
        chatId,
        content: systemMessage.content,
        type: 'system',
        createdAt: systemMessage.createdAt,
      });

      console.log(`✓ User ${userId} added to group ${chatId} by ${socket.userId}`);
    } catch (error) {
      console.error('Error in group:add_member:', error);
      socket.emit('error', {
        code: 'ADD_MEMBER_FAILED',
        message: 'Failed to add member',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // REMOVE MEMBER FROM GROUP
  // ─────────────────────────────────────────────────────────────────────

  socket.on('group:remove_member', async (data: { chatId: string; userId: string }) => {
    try {
      const { chatId, userId } = data;

      // Verify admin
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', {
          code: 'CHAT_NOT_FOUND',
          message: 'Chat not found',
        });
        return;
      }

      if (!chat.admins.some((admin: any) => admin.toString() === socket.userId)) {
        socket.emit('error', {
          code: 'NOT_GROUP_ADMIN',
          message: 'Only admins can remove members',
        });
        return;
      }

      // Remove member
      await chatService.removeGroupMember(chatId, userId, socket.userId!);

      // Create system message
      const removedUser = await User.findById(userId);
      const removerUser = await User.findById(socket.userId);
      const systemMessage = new Message({
        chat: chatId,
        sender: null,
        type: 'system',
        content: `${removerUser?.displayName} removed ${removedUser?.displayName}`,
        status: 'sent',
      });
      await systemMessage.save();

      // Update last message
      await Chat.updateOne(
        { _id: chatId },
        {
          $set: {
            'lastMessage.messageId': systemMessage._id,
            'lastMessage.content': systemMessage.content,
            'lastMessage.type': 'system',
            'lastMessage.sentAt': systemMessage.createdAt,
          },
        }
      );

      // Notify removed member
      io.to(`user:${userId}`).emit('group:member_removed', {
        chatId,
        userId,
        removedBy: socket.userId,
      });

      // Broadcast system message to group
      io.to(`chat:${chatId}`).emit('group:system_message', {
        chatId,
        content: systemMessage.content,
        type: 'system',
        createdAt: systemMessage.createdAt,
      });

      console.log(`✓ User ${userId} removed from group ${chatId} by ${socket.userId}`);
    } catch (error) {
      console.error('Error in group:remove_member:', error);
      socket.emit('error', {
        code: 'REMOVE_MEMBER_FAILED',
        message: 'Failed to remove member',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // USER LEAVES GROUP
  // ─────────────────────────────────────────────────────────────────────

  socket.on('group:leave', async (data: { chatId: string }) => {
    try {
      const { chatId } = data;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', {
          code: 'CHAT_NOT_FOUND',
          message: 'Chat not found',
        });
        return;
      }

      // Leave group
      await chatService.leaveGroupChat(chatId, socket.userId!);

      // Create system message
      const leavingUser = await User.findById(socket.userId);
      const systemMessage = new Message({
        chat: chatId,
        sender: null,
        type: 'system',
        content: `${leavingUser?.displayName} left the group`,
        status: 'sent',
      });
      await systemMessage.save();

      // Update last message
      await Chat.updateOne(
        { _id: chatId },
        {
          $set: {
            'lastMessage.messageId': systemMessage._id,
            'lastMessage.content': systemMessage.content,
            'lastMessage.type': 'system',
            'lastMessage.sentAt': systemMessage.createdAt,
          },
        }
      );

      // Broadcast system message to group
      io.to(`chat:${chatId}`).emit('group:system_message', {
        chatId,
        content: systemMessage.content,
        type: 'system',
        createdAt: systemMessage.createdAt,
      });

      socket.leave(`chat:${chatId}`);

      console.log(`✓ User ${socket.userId} left group ${chatId}`);
    } catch (error) {
      console.error('Error in group:leave:', error);
      socket.emit('error', {
        code: 'LEAVE_GROUP_FAILED',
        message: 'Failed to leave group',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // UPDATE GROUP METADATA
  // ─────────────────────────────────────────────────────────────────────

  socket.on('group:update', async (data: any) => {
    try {
      const { chatId, name, description, groupIcon } = data;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', {
          code: 'CHAT_NOT_FOUND',
          message: 'Chat not found',
        });
        return;
      }

      if (!chat.admins.some((admin: any) => admin.toString() === socket.userId)) {
        socket.emit('error', {
          code: 'NOT_GROUP_ADMIN',
          message: 'Only admins can update group',
        });
        return;
      }

      // Update group
      const updatedChat = await chatService.updateGroupMetadata(chatId, socket.userId!, {
        name,
        description,
        groupIcon,
      });

      // Broadcast update to group
      io.to(`chat:${chatId}`).emit('group:updated', {
        chatId,
        changes: {
          name: updatedChat.name,
          description: updatedChat.description,
          groupIcon: updatedChat.groupIcon,
        },
      });

      console.log(`✓ Group ${chatId} updated by ${socket.userId}`);
    } catch (error) {
      console.error('Error in group:update:', error);
      socket.emit('error', {
        code: 'UPDATE_GROUP_FAILED',
        message: 'Failed to update group',
      });
    }
  });
}
