import Message, { IMessage } from '../models/Message.ts';
import Chat from '../models/Chat.ts';
import User from '../models/User.ts';
import { createNotFoundError, createForbiddenError } from '../utils/errors.ts';
import mongoose from 'mongoose';

/**
 * Get paginated messages for a chat (cursor-based)
 */
export async function getMessages(
  chatId: string,
  userId: string,
  beforeId: string | null = null,
  limit: number = 30
) {
  // Verify user is participant of chat
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.participants.some((p: any) => p.toString() === userId)) {
    throw createForbiddenError('You are not a participant of this chat', 'NOT_CHAT_PARTICIPANT');
  }

  const query: any = {
    chat: chatId,
    deletedForEveryone: false,
    deletedFor: { $ne: userId },
  };

  if (beforeId) {
    query._id = { $lt: beforeId };
  }

  const messages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate('sender', 'displayName avatar')
    .populate('replyTo', 'content sender type')
    .lean();

  return messages.reverse();
}

/**
 * Create a new message
 */
export async function createMessage(
  chatId: string,
  senderId: string,
  content: string | undefined,
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system',
  replyTo?: string,
  media?: any
) {
  // Verify chat exists and user is participant
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.participants.some((p: any) => p.toString() === senderId)) {
    throw createForbiddenError('You are not a participant of this chat', 'NOT_CHAT_PARTICIPANT');
  }

  // Blocking logic: check if either user has blocked the other in 1-on-1 chats
  if (!chat.isGroup) {
    const recipientId = chat.participants.find((p: any) => p.toString() !== senderId);
    if (recipientId) {
      const sender = await User.findById(senderId).select('blockedUsers');
      const recipient = await User.findById(recipientId).select('blockedUsers');
      
      if (sender?.blockedUsers.includes(recipientId as any)) {
        throw createForbiddenError('You have blocked this user', 'USER_BLOCKED');
      }
      if (recipient?.blockedUsers.includes(senderId as any)) {
        throw createForbiddenError('You have been blocked by this user', 'USER_BLOCKED');
      }
    }
  }

  const message = new Message({
    chat: chatId,
    sender: senderId,
    type,
    content,
    media,
    replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : null,
    status: 'sent',
    readBy: [{ user: senderId, readAt: new Date() }],
    deliveredTo: [{ user: senderId, deliveredAt: new Date() }],
  });

  await message.save();
  await message.populate('sender', 'displayName avatar');

  return message;
}

/**
 * Mark message as delivered
 */
export async function markMessageDelivered(messageId: string, userId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw createNotFoundError('Message');

  // Check if user already marked as delivered
  const alreadyDelivered = message.deliveredTo.some((d: any) => d.user.toString() === userId);
  if (!alreadyDelivered) {
    message.deliveredTo.push({
      user: new mongoose.Types.ObjectId(userId),
      deliveredAt: new Date(),
    });
    await message.save();
  }

  return message;
}

/**
 * Mark message as read
 */
export async function markMessageRead(messageId: string, userId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw createNotFoundError('Message');

  // Check if user already marked as read
  const alreadyRead = message.readBy.some((r: any) => r.user.toString() === userId);
  if (!alreadyRead) {
    message.readBy.push({
      user: new mongoose.Types.ObjectId(userId),
      readAt: new Date(),
    });

    // Update status if all participants have read
    const chat = await Chat.findById(message.chat);
    if (chat && message.readBy.length === chat.participants.length - 1) {
      message.status = 'read';
    }

    await message.save();
  }

  return message;
}

/**
 * Mark multiple messages as read
 */
export async function markMessagesRead(messageIds: string[], userId: string) {
  const results = await Promise.all(
    messageIds.map(id => markMessageRead(id, userId).catch(() => null))
  );

  return results.filter(r => r !== null);
}

/**
 * Edit message
 */
export async function editMessage(messageId: string, userId: string, newContent: string) {
  const message = await Message.findById(messageId);
  if (!message) throw createNotFoundError('Message');

  if (message.sender?.toString() !== userId) {
    throw createForbiddenError('You can only edit your own messages', 'CANNOT_EDIT_MESSAGE');
  }

  if (message.deletedForEveryone) {
    throw createForbiddenError('Cannot edit deleted message', 'CANNOT_EDIT_MESSAGE');
  }

  message.content = newContent;
  await message.save();

  return message;
}

/**
 * Delete message for a user
 */
export async function deleteMessageForUser(messageId: string, userId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw createNotFoundError('Message');

  if (!message.deletedFor.includes(new mongoose.Types.ObjectId(userId))) {
    message.deletedFor.push(new mongoose.Types.ObjectId(userId));
    await message.save();
  }

  return message;
}

/**
 * Delete message for everyone
 */
export async function deleteMessageForEveryone(messageId: string, userId: string) {
  const message = await Message.findById(messageId);
  if (!message) throw createNotFoundError('Message');

  if (message.sender?.toString() !== userId) {
    throw createForbiddenError('You can only delete your own messages', 'CANNOT_DELETE_MESSAGE');
  }

  message.deletedForEveryone = true;
  await message.save();

  return message;
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId: string, userId: string) {
  const message = await Message.findById(messageId)
    .populate('sender', 'displayName avatar')
    .populate('replyTo', 'content sender type');

  if (!message) throw createNotFoundError('Message');

  // Check if user has deleted this message
  if (message.deletedFor.some((d: any) => d.toString() === userId)) {
    throw createNotFoundError('Message');
  }

  if (message.deletedForEveryone) {
    throw createNotFoundError('Message');
  }

  return message;
}

/**
 * Get unread message count for a chat
 */
export async function getUnreadCount(chatId: string, userId: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  const unreadCount = chat.unreadCounts.get(userId) || 0;
  return unreadCount;
}
