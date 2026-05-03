import Chat, { IChat } from '../models/Chat.ts';
import Message from '../models/Message.ts';
import User from '../models/User.ts';
import { createNotFoundError, createForbiddenError } from '../utils/errors.ts';
import mongoose from 'mongoose';

/**
 * Get all chats for a user, sorted by most recent message
 */
export async function getChatList(userId: string, limit: number = 50, skip: number = 0) {
  const chats = await Chat.find({ participants: userId })
    .sort({ 'lastMessage.sentAt': -1 })
    .skip(skip)
    .limit(limit)
    .populate('participants', 'displayName avatar isOnline lastSeen')
    .populate('lastMessage.sender', 'displayName')
    .lean();

  return chats;
}

/**
 * Get single chat by ID
 */
export async function getChatById(chatId: string, userId: string) {
  const chat = await Chat.findById(chatId)
    .populate('participants', 'displayName avatar isOnline lastSeen')
    .populate('admins', 'displayName')
    .populate('lastMessage.sender', 'displayName');

  if (!chat) {
    throw createNotFoundError('Chat');
  }

  // Check if user is participant
  if (!chat.participants.some((p: any) => p._id.toString() === userId)) {
    throw createForbiddenError('You are not a participant of this chat', 'NOT_CHAT_PARTICIPANT');
  }

  return chat;
}

/**
 * Find or create a 1-on-1 chat between two users
 */
export async function findOrCreateDirectChat(userA: string, userB: string) {
  let chat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [userA, userB], $size: 2 },
  });

  if (!chat) {
    chat = await Chat.create({
      isGroup: false,
      participants: [userA, userB],
      unreadCounts: new Map([[userA, 0], [userB, 0]]),
    });
  }

  return chat;
}

/**
 * Create a group chat
 */
export async function createGroupChat(
  name: string,
  memberIds: string[],
  createdBy: string,
  groupIcon?: string,
  description?: string
) {
  const uniqueMembers = Array.from(new Set([createdBy, ...memberIds]));

  const chat = await Chat.create({
    isGroup: true,
    name,
    groupIcon,
    description,
    createdBy,
    participants: uniqueMembers,
    admins: [createdBy],
    unreadCounts: new Map(uniqueMembers.map(id => [id, 0])),
  });

  // Fetch creator's display name for system message
  const creator = await User.findById(createdBy).select('displayName');
  const creatorName = creator?.displayName || 'Someone';

  // Create a system message announcing who created the group
  const systemMessage = await Message.create({
    chat: chat._id,
    sender: createdBy,
    type: 'system',
    content: `${creatorName} created group "${name}"`,
    status: 'sent',
    readBy: [],
    deliveredTo: [],
  });

  // Update lastMessage on the chat
  chat.lastMessage = {
    messageId: systemMessage._id,
    content: systemMessage.content,
    sender: createdBy as any,
    type: 'system',
    sentAt: systemMessage.createdAt,
  } as any;
  await chat.save();

  return chat.populate('participants', 'displayName avatar');
}

/**
 * Reset unread count for a chat for a specific user
 */
export async function resetUnreadCount(chatId: string, userId: string) {
  return Chat.updateOne(
    { _id: chatId },
    { $set: { [`unreadCounts.${userId}`]: 0 } }
  );
}

/**
 * Increment unread count for all participants except sender
 */
export async function incrementUnreadForAll(chatId: string, senderId: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  const update: Record<string, number> = {};
  chat.participants.forEach((participantId: any) => {
    if (participantId.toString() !== senderId) {
      const key = `unreadCounts.${participantId}`;
      update[key] = 1;
    }
  });

  if (Object.keys(update).length === 0) return;

  return Chat.updateOne({ _id: chatId }, { $inc: update });
}

/**
 * Update last message in chat (denormalized)
 */
export async function updateLastMessage(
  chatId: string,
  messageId: string,
  content: string,
  senderId: string,
  type: string,
  sentAt: Date
) {
  return Chat.updateOne(
    { _id: chatId },
    {
      $set: {
        'lastMessage.messageId': messageId,
        'lastMessage.content': content.substring(0, 100),
        'lastMessage.sender': senderId,
        'lastMessage.type': type,
        'lastMessage.sentAt': sentAt,
      },
    }
  );
}

/**
 * Add member to group chat
 */
export async function addGroupMember(chatId: string, userId: string, addedBy: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.isGroup) {
    throw createForbiddenError('Cannot add members to a 1-on-1 chat', 'INVALID_GROUP_OPERATION');
  }

  // Check if requester is admin
  if (!chat.admins.some((admin: any) => admin.toString() === addedBy)) {
    throw createForbiddenError('Only admins can add members', 'NOT_GROUP_ADMIN');
  }

  // Check if user already in chat
  if (chat.participants.some((p: any) => p.toString() === userId)) {
    throw createForbiddenError('User already in chat', 'INVALID_GROUP_OPERATION');
  }

  chat.participants.push(new mongoose.Types.ObjectId(userId));
  chat.unreadCounts.set(userId, 0);

  return chat.save();
}

/**
 * Remove member from group chat
 */
export async function removeGroupMember(chatId: string, userId: string, removedBy: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.isGroup) {
    throw createForbiddenError('Cannot remove members from a 1-on-1 chat', 'INVALID_GROUP_OPERATION');
  }

  // Check if requester is admin
  if (!chat.admins.some((admin: any) => admin.toString() === removedBy)) {
    throw createForbiddenError('Only admins can remove members', 'NOT_GROUP_ADMIN');
  }

  // Remove participant
  chat.participants = chat.participants.filter((p: any) => p.toString() !== userId);
  chat.unreadCounts.delete(userId);

  // If removed user is admin, remove from admins too
  if (chat.admins.some((admin: any) => admin.toString() === userId)) {
    chat.admins = chat.admins.filter((admin: any) => admin.toString() !== userId);
  }

  return chat.save();
}

/**
 * Remove user from group chat (user leaving)
 */
export async function leaveGroupChat(chatId: string, userId: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.isGroup) {
    throw createForbiddenError('Cannot leave a 1-on-1 chat', 'INVALID_GROUP_OPERATION');
  }

  // Remove participant
  chat.participants = chat.participants.filter((p: any) => p.toString() !== userId);
  chat.unreadCounts.delete(userId);

  // If user is admin and is the last admin, promote oldest member
  const isAdmin = chat.admins.some((admin: any) => admin.toString() === userId);
  if (isAdmin) {
    chat.admins = chat.admins.filter((admin: any) => admin.toString() !== userId);

    // If no admins left, promote oldest member
    if (chat.admins.length === 0 && chat.participants.length > 0) {
      chat.admins.push(chat.participants[0]);
    }
  }

  return chat.save();
}

/**
 * Update group metadata
 */
export async function updateGroupMetadata(
  chatId: string,
  userId: string,
  updates: { name?: string; description?: string; groupIcon?: string }
) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  if (!chat.isGroup) {
    throw createForbiddenError('Cannot update a 1-on-1 chat', 'INVALID_GROUP_OPERATION');
  }

  // Check if requester is admin
  if (!chat.admins.some((admin: any) => admin.toString() === userId)) {
    throw createForbiddenError('Only admins can update group', 'NOT_GROUP_ADMIN');
  }

  if (updates.name) chat.name = updates.name;
  if (updates.description) chat.description = updates.description;
  if (updates.groupIcon) chat.groupIcon = updates.groupIcon;

  return chat.save();
}

/**
 * Delete chat (soft delete by removing user from participants)
 */
export async function deleteChat(chatId: string, userId: string) {
  const chat = await Chat.findById(chatId);
  if (!chat) throw createNotFoundError('Chat');

  // For 1-on-1 chats, just remove the user
  if (!chat.isGroup) {
    chat.participants = chat.participants.filter((p: any) => p.toString() !== userId);
    chat.unreadCounts.delete(userId);
    return chat.save();
  }

  // For group chats, use leaveGroupChat logic
  return leaveGroupChat(chatId, userId);
}
