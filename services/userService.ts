import User from '../models/User.js';
import { createNotFoundError } from '../utils/errors.js';
import mongoose from 'mongoose';

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw createNotFoundError('User');
  }
  return user;
}

/**
 * Get multiple users by IDs
 */
export async function getUsersByIds(userIds: string[]) {
  return User.find({ _id: { $in: userIds } }).select('-password');
}

/**
 * Search users by display name or username
 */
export async function searchUsers(query: string, limit: number = 20) {
  return User.find({
    $or: [
      { displayName: { $regex: query, $options: 'i' } },
      { username: { $regex: query, $options: 'i' } }
    ]
  })
    .limit(limit)
    .select('-password');
}

/**
 * Update user presence status
 */
export async function updatePresence(userId: string, isOnline: boolean) {
  return User.findByIdAndUpdate(
    userId,
    {
      isOnline,
      ...(isOnline ? {} : { lastSeen: new Date() }),
    },
    { new: true }
  );
}

/**
 * Get user's contacts
 */
export async function getUserContacts(userId: string) {
  const user = await User.findById(userId).populate('contacts', 'displayName avatar isOnline lastSeen');
  if (!user) {
    throw createNotFoundError('User');
  }
  return user.contacts;
}

/**
 * Add contact
 */
export async function addContact(userId: string, contactId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User');
  }

  const contact = await User.findById(contactId);
  if (!contact) {
    throw createNotFoundError('User');
  }

  // Check if already a contact
  if (!user.contacts.includes(new mongoose.Types.ObjectId(contactId))) {
    user.contacts.push(new mongoose.Types.ObjectId(contactId));
    await user.save();
  }

  return user;
}

/**
 * Remove contact
 */
export async function removeContact(userId: string, contactId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User');
  }

  user.contacts = user.contacts.filter((c: any) => c.toString() !== contactId);
  await user.save();

  return user;
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(
  userId: string,
  privacy: {
    lastSeen?: 'everyone' | 'contacts' | 'nobody';
    avatar?: 'everyone' | 'contacts' | 'nobody';
    about?: 'everyone' | 'contacts' | 'nobody';
  }
) {
  const user = await User.findById(userId);
  if (!user) {
    throw createNotFoundError('User');
  }

  if (privacy.lastSeen) user.privacy.lastSeen = privacy.lastSeen;
  if (privacy.avatar) user.privacy.avatar = privacy.avatar;
  if (privacy.about) user.privacy.about = privacy.about;

  await user.save();
  return user;
}

/**
 * Check if user is online
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select('isOnline');
  return user?.isOnline ?? false;
}

/**
 * Get user's last seen time
 */
export async function getUserLastSeen(userId: string) {
  const user = await User.findById(userId).select('lastSeen');
  return user?.lastSeen ?? null;
}

/**
 * Bulk update user online status
 */
export async function bulkUpdatePresence(userIds: string[], isOnline: boolean) {
  return User.updateMany(
    { _id: { $in: userIds } },
    {
      isOnline,
      ...(isOnline ? {} : { lastSeen: new Date() }),
    }
  );
}

/**
 * Discover random users (exclude self, contacts, blocked)
 */
export async function discoverUsers(userId: string, limit: number = 12) {
  const user = await User.findById(userId).select('contacts blockedUsers');
  if (!user) {
    throw createNotFoundError('User');
  }

  const excludeIds = [
    new mongoose.Types.ObjectId(userId),
    ...user.contacts.map((c: any) => new mongoose.Types.ObjectId(c)),
    ...(user.blockedUsers || []).map((b: any) => new mongoose.Types.ObjectId(b)),
  ];

  return User.aggregate([
    { $match: { _id: { $nin: excludeIds } } },
    { $sample: { size: limit } },
    {
      $project: {
        _id: 1,
        username: 1,
        displayName: 1,
        avatar: 1,
        about: 1,
        vibe: 1,
        isOnline: 1,
      },
    },
  ]);
}

/**
 * Block a user
 */
export async function blockUser(userId: string, targetId: string) {
  const user = await User.findById(userId);
  if (!user) throw createNotFoundError('User');

  const target = await User.findById(targetId);
  if (!target) throw createNotFoundError('User');

  if (!user.blockedUsers) user.blockedUsers = [] as any;

  const alreadyBlocked = user.blockedUsers.some(
    (b: any) => b.toString() === targetId
  );
  if (!alreadyBlocked) {
    user.blockedUsers.push(new mongoose.Types.ObjectId(targetId));
  }

  // Also remove from contacts if present
  user.contacts = user.contacts.filter((c: any) => c.toString() !== targetId);

  await user.save();
  return user;
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string, targetId: string) {
  const user = await User.findById(userId);
  if (!user) throw createNotFoundError('User');

  user.blockedUsers = (user.blockedUsers || []).filter(
    (b: any) => b.toString() !== targetId
  ) as any;

  await user.save();
  return user;
}

/**
 * Get blocked users list
 */
export async function getBlockedUsers(userId: string) {
  const user = await User.findById(userId).populate(
    'blockedUsers',
    'displayName avatar username'
  );
  if (!user) throw createNotFoundError('User');
  return user.blockedUsers || [];
}

