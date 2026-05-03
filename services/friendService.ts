import FriendRequest from '../models/FriendRequest.ts';
import User from '../models/User.ts';
import Chat from '../models/Chat.ts';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/errors.ts';
import mongoose from 'mongoose';

/**
 * Send a friend request
 */
export async function sendRequest(fromId: string, toId: string) {
  if (fromId === toId) {
    throw createValidationError('Cannot send a friend request to yourself');
  }

  const [fromUser, toUser] = await Promise.all([
    User.findById(fromId).select('contacts blockedUsers'),
    User.findById(toId).select('contacts blockedUsers'),
  ]);

  if (!fromUser || !toUser) throw createNotFoundError('User');

  // Check if blocked (either direction)
  const fromBlocked = (fromUser.blockedUsers || []).some(
    (b: any) => b.toString() === toId
  );
  const toBlocked = (toUser.blockedUsers || []).some(
    (b: any) => b.toString() === fromId
  );
  if (fromBlocked || toBlocked) {
    throw createForbiddenError('Cannot send request to this user', 'USER_BLOCKED');
  }

  // Check if already friends
  const alreadyFriends = fromUser.contacts.some(
    (c: any) => c.toString() === toId
  );
  if (alreadyFriends) {
    throw createValidationError('Already friends with this user');
  }

  // Check for existing pending request in either direction
  const existing = await FriendRequest.findOne({
    $or: [
      { from: fromId, to: toId, status: 'pending' },
      { from: toId, to: fromId, status: 'pending' },
    ],
  });
  if (existing) {
    throw createValidationError('A pending request already exists');
  }

  // Remove any old declined request between these users so we can create a fresh one
  await FriendRequest.deleteMany({
    $or: [
      { from: fromId, to: toId },
      { from: toId, to: fromId },
    ],
    status: { $ne: 'pending' },
  });

  const request = await FriendRequest.create({ from: fromId, to: toId });
  return request;
}

/**
 * Accept a friend request
 */
export async function acceptRequest(requestId: string, userId: string) {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw createNotFoundError('Friend request');

  // Only the recipient can accept
  if (request.to.toString() !== userId) {
    throw createForbiddenError('Only the recipient can accept this request', 'NOT_RECIPIENT');
  }

  if (request.status !== 'pending') {
    throw createValidationError('This request is no longer pending');
  }

  request.status = 'accepted';
  await request.save();

  const fromId = request.from.toString();
  const toId = request.to.toString();

  // Add to each other's contacts
  await Promise.all([
    User.findByIdAndUpdate(fromId, {
      $addToSet: { contacts: new mongoose.Types.ObjectId(toId) },
    }),
    User.findByIdAndUpdate(toId, {
      $addToSet: { contacts: new mongoose.Types.ObjectId(fromId) },
    }),
  ]);

  // Find or create a DM conversation
  let chat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [fromId, toId], $size: 2 },
  });

  if (!chat) {
    chat = await Chat.create({
      isGroup: false,
      participants: [fromId, toId],
      unreadCounts: new Map([[fromId, 0], [toId, 0]]),
    });
  }

  return { request, chatId: chat._id.toString() };
}

/**
 * Decline a friend request
 */
export async function declineRequest(requestId: string, userId: string) {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw createNotFoundError('Friend request');

  if (request.to.toString() !== userId) {
    throw createForbiddenError('Only the recipient can decline this request', 'NOT_RECIPIENT');
  }

  if (request.status !== 'pending') {
    throw createValidationError('This request is no longer pending');
  }

  request.status = 'declined';
  await request.save();
  return request;
}

/**
 * Cancel a sent friend request
 */
export async function cancelRequest(requestId: string, userId: string) {
  const request = await FriendRequest.findById(requestId);
  if (!request) throw createNotFoundError('Friend request');

  if (request.from.toString() !== userId) {
    throw createForbiddenError('Only the sender can cancel this request', 'NOT_SENDER');
  }

  if (request.status !== 'pending') {
    throw createValidationError('This request is no longer pending');
  }

  await FriendRequest.findByIdAndDelete(requestId);
  return { deleted: true };
}

/**
 * Unfriend a user
 */
export async function unfriend(userId: string, targetId: string) {
  // Remove from both contacts arrays
  await Promise.all([
    User.findByIdAndUpdate(userId, {
      $pull: { contacts: new mongoose.Types.ObjectId(targetId) },
    }),
    User.findByIdAndUpdate(targetId, {
      $pull: { contacts: new mongoose.Types.ObjectId(userId) },
    }),
  ]);

  // Remove any accepted friend requests between them
  await FriendRequest.deleteMany({
    $or: [
      { from: userId, to: targetId },
      { from: targetId, to: userId },
    ],
  });

  return { unfriended: true };
}

/**
 * Get the relationship status between two users
 * Returns: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked'
 * Also returns the requestId if there is a pending request
 */
export async function getRelationshipStatus(userId: string, targetId: string) {
  const user = await User.findById(userId).select('contacts blockedUsers');
  if (!user) throw createNotFoundError('User');

  // Check blocked
  const isBlocked = (user.blockedUsers || []).some(
    (b: any) => b.toString() === targetId
  );
  if (isBlocked) return { status: 'blocked' as const, requestId: null };

  // Check if target blocked us
  const targetUser = await User.findById(targetId).select('blockedUsers');
  const targetBlockedUs = (targetUser?.blockedUsers || []).some(
    (b: any) => b.toString() === userId
  );
  if (targetBlockedUs) return { status: 'blocked_by_them' as const, requestId: null };

  // Check friends
  const isFriend = user.contacts.some(
    (c: any) => c.toString() === targetId
  );
  if (isFriend) return { status: 'friends' as const, requestId: null };

  // Check pending requests
  const pendingRequest = await FriendRequest.findOne({
    $or: [
      { from: userId, to: targetId, status: 'pending' },
      { from: targetId, to: userId, status: 'pending' },
    ],
  });

  if (pendingRequest) {
    if (pendingRequest.from.toString() === userId) {
      return { status: 'pending_sent' as const, requestId: pendingRequest._id.toString() };
    } else {
      return { status: 'pending_received' as const, requestId: pendingRequest._id.toString() };
    }
  }

  return { status: 'none' as const, requestId: null };
}

/**
 * Get public profile data with mutual friends count
 */
export async function getPublicProfile(userId: string, viewerId: string) {
  const [targetUser, viewerUser] = await Promise.all([
    User.findById(userId).select('-password'),
    User.findById(viewerId).select('contacts'),
  ]);

  if (!targetUser) throw createNotFoundError('User');
  if (!viewerUser) throw createNotFoundError('Viewer');

  // Count mutual friends
  const targetContacts = (targetUser.contacts || []).map((c: any) => c.toString());
  const viewerContacts = (viewerUser.contacts || []).map((c: any) => c.toString());
  const mutualFriendsCount = targetContacts.filter((c: string) =>
    viewerContacts.includes(c)
  ).length;

  // Count groups
  const groupCount = await Chat.countDocuments({
    participants: userId,
    isGroup: true,
  });

  // Get relationship status
  const { status, requestId } = await getRelationshipStatus(viewerId, userId);

  // Find existing conversation (for "Message" button)
  const existingChat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [userId, viewerId], $size: 2 },
  });

  return {
    user: {
      id: targetUser._id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatar: targetUser.avatar,
      about: targetUser.about,
      vibe: targetUser.vibe,
      isOnline: targetUser.isOnline,
      lastSeen: targetUser.lastSeen,
      contactsCount: targetUser.contacts?.length || 0,
      groupsCount: groupCount,
      mutualFriendsCount,
      createdAt: targetUser.createdAt,
    },
    relationshipStatus: status,
    requestId,
    conversationId: existingChat?._id?.toString() || null,
  };
}

/**
 * Get incoming pending friend requests
 */
export async function getIncomingRequests(userId: string) {
  return FriendRequest.find({ to: userId, status: 'pending' })
    .populate('from', 'displayName avatar username')
    .sort({ createdAt: -1 });
}

/**
 * Get outgoing pending friend requests
 */
export async function getOutgoingRequests(userId: string) {
  return FriendRequest.find({ from: userId, status: 'pending' })
    .populate('to', 'displayName avatar username')
    .sort({ createdAt: -1 });
}
