import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Status from '../models/Status.js';
import User from '../models/User.js';
import { createAuthError, createValidationError, createNotFoundError, createForbiddenError } from '../utils/errors.js';

/**
 * POST /api/status
 * Upload a new status. Expects { imageUrl } in the body.
 * The client uploads the image to Cloudinary first, then sends the URL here.
 */
export async function uploadStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw createAuthError('User not authenticated');

  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw createValidationError('imageUrl is required and must be a string');
  }

  // Basic Cloudinary URL validation
  if (!imageUrl.includes('cloudinary.com')) {
    throw createValidationError('imageUrl must be a valid Cloudinary URL');
  }

  const status = await Status.create({
    user: req.user.userId,
    imageUrl,
  });

  // Populate user info before responding
  await status.populate('user', 'displayName avatar username');

  res.status(201).json({
    success: true,
    data: { status },
  });
}

/**
 * GET /api/status/feed
 * Fetch statuses from the last 24 hours, limited to the current user's
 * contacts (friends) + the user's own statuses.
 */
export async function getFeed(req: AuthRequest, res: Response) {
  if (!req.user) throw createAuthError('User not authenticated');

  // Get the current user's contacts list and blocked users
  const currentUser = await User.findById(req.user.userId).select('contacts blockedUsers');
  if (!currentUser) throw createAuthError('User not found');

  // Find users who have blocked the current user
  const blockedByUsers = await User.find({ blockedUsers: req.user.userId }).select('_id');
  const blockedByIds = blockedByUsers.map(u => u._id.toString());
  
  const myBlockedIds = currentUser.blockedUsers.map((id: any) => id.toString());
  const excludedIds = new Set([...blockedByIds, ...myBlockedIds]);

  // Build the list of user IDs whose statuses we want:
  // the user themselves + all their contacts/friends (excluding blocked)
  const friendIds = (currentUser.contacts || [])
    .map((c: any) => c.toString())
    .filter((id: string) => !excludedIds.has(id));

  const allowedUserIds = [req.user.userId, ...friendIds];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const statuses = await Status.find({
    user: { $in: allowedUserIds },
    createdAt: { $gte: cutoff },
  })
    .populate('user', 'displayName avatar username')
    .populate('viewers.user', 'displayName avatar username')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: { statuses },
  });
}

/**
 * DELETE /api/status/:id
 * Delete a status. Only the owner can delete their own status.
 */
export async function deleteStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw createAuthError('User not authenticated');

  const status = await Status.findById(req.params.id);
  if (!status) throw createNotFoundError('Status');

  // Ensure the user owns this status
  if (status.user.toString() !== req.user.userId) {
    throw createForbiddenError('You can only delete your own status');
  }

  await Status.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Status deleted',
  });
}

/**
 * POST /api/status/:id/view
 * Mark a status as viewed by the current user.
 */
export async function markAsViewed(req: AuthRequest, res: Response) {
  if (!req.user) throw createAuthError('User not authenticated');

  const status = await Status.findById(req.params.id);
  if (!status) throw createNotFoundError('Status');

  // Do not mark own status as viewed by self
  if (status.user.toString() === req.user.userId) {
    return res.json({ success: true });
  }

  // Check if already viewed
  const alreadyViewed = status.viewers.some((v: any) => v.user.toString() === req.user!.userId);
  
  if (!alreadyViewed) {
    status.viewers.push({ user: req.user.userId as any, viewedAt: new Date() });
    await status.save();
  }

  res.json({ success: true });
}
