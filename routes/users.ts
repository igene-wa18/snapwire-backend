import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createValidationError } from '../utils/errors.js';
import * as userService from '../services/userService.js';
import * as friendService from '../services/friendService.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/users/search
 * Search users by display name or username
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const query = req.query.q as string;
    if (!query || query.length < 2) {
      throw createValidationError('Search query must be at least 2 characters');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const users = await userService.searchUsers(query, limit);

    res.json({
      success: true,
      data: { users },
    });
  })
);

/**
 * GET /api/users/discover
 * Get random users for discovery (excludes self, contacts, blocked)
 */
router.get(
  '/discover',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 12, 30);
    const users = await userService.discoverUsers(req.user.userId, limit);

    res.json({
      success: true,
      data: { users },
    });
  })
);

/**
 * GET /api/users/blocked
 * Get blocked users list
 */
router.get(
  '/blocked',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const blockedUsers = await userService.getBlockedUsers(req.user.userId);

    res.json({
      success: true,
      data: { blockedUsers },
    });
  })
);

/**
 * POST /api/users/block
 * Block a user
 */
router.post(
  '/block',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const schema = z.object({
      userId: z.string(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { userId: targetId } = result.data;

    if (targetId === req.user.userId) {
      throw createValidationError('Cannot block yourself');
    }

    await userService.blockUser(req.user.userId, targetId);

    res.json({
      success: true,
      message: 'User blocked',
    });
  })
);

/**
 * DELETE /api/users/block/:userId
 * Unblock a user
 */
router.delete(
  '/block/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    await userService.unblockUser(req.user.userId, req.params.userId);

    res.json({
      success: true,
      message: 'User unblocked',
    });
  })
);

/**
 * GET /api/users/:id/public
 * Get a user's public profile with relationship status and mutual friends
 */
router.get(
  '/:id/public',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const data = await friendService.getPublicProfile(
      req.params.id,
      req.user.userId
    );

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          about: user.about,
          vibe: user.vibe,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
        },
      },
    });
  })
);

/**
 * GET /api/users/:id/contacts
 * Get user's contacts
 */
router.get(
  '/:id/contacts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const contacts = await userService.getUserContacts(req.params.id);

    res.json({
      success: true,
      data: { contacts },
    });
  })
);

/**
 * POST /api/users/contacts/add
 * Add a contact
 */
router.post(
  '/contacts/add',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const schema = z.object({
      contactId: z.string(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { contactId } = result.data;

    if (contactId === req.user.userId) {
      throw createValidationError('Cannot add yourself as a contact');
    }

    await userService.addContact(req.user.userId, contactId);

    res.json({
      success: true,
      message: 'Contact added',
    });
  })
);

/**
 * DELETE /api/users/contacts/:contactId
 * Remove a contact
 */
router.delete(
  '/contacts/:contactId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    await userService.removeContact(req.user.userId, req.params.contactId);

    res.json({
      success: true,
      message: 'Contact removed',
    });
  })
);

/**
 * PATCH /api/users/privacy
 * Update privacy settings
 */
router.patch(
  '/privacy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const schema = z.object({
      lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      avatar: z.enum(['everyone', 'contacts', 'nobody']).optional(),
      about: z.enum(['everyone', 'contacts', 'nobody']).optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const user = await userService.updatePrivacySettings(req.user.userId, result.data);

    res.json({
      success: true,
      data: {
        privacy: user.privacy,
      },
    });
  })
);

/**
 * GET /api/users/:id/status
 * Get user's online status
 */
router.get(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const isOnline = await userService.isUserOnline(req.params.id);
    const lastSeen = await userService.getUserLastSeen(req.params.id);

    res.json({
      success: true,
      data: {
        isOnline,
        lastSeen,
      },
    });
  })
);

export default router;
