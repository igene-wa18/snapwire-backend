import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createValidationError } from '../utils/errors.js';
import * as friendService from '../services/friendService.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/friends/status/:userId
 * Get the relationship status between current user and target
 */
router.get(
  '/status/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const { status, requestId } = await friendService.getRelationshipStatus(
      req.user.userId,
      req.params.userId
    );

    res.json({
      success: true,
      data: { status, requestId },
    });
  })
);

/**
 * POST /api/friends/request
 * Send a friend request
 */
router.post(
  '/request',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const schema = z.object({ userId: z.string() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const request = await friendService.sendRequest(
      req.user.userId,
      result.data.userId
    );

    // Emit socket event to the target user
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${result.data.userId}`).emit('friend_request_received', {
        from: req.user.userId,
        requestId: request._id.toString(),
      });
    }

    res.status(201).json({
      success: true,
      data: { request },
    });
  })
);

/**
 * POST /api/friends/accept/:requestId
 * Accept a pending friend request
 */
router.post(
  '/accept/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const { request, chatId } = await friendService.acceptRequest(
      req.params.requestId,
      req.user.userId
    );

    // Emit socket event to the sender
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${request.from.toString()}`).emit('friend_request_accepted', {
        from: req.user.userId,
        chatId,
      });
    }

    res.json({
      success: true,
      data: { request, chatId },
    });
  })
);

/**
 * POST /api/friends/decline/:requestId
 * Decline a pending friend request
 */
router.post(
  '/decline/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const request = await friendService.declineRequest(
      req.params.requestId,
      req.user.userId
    );

    // Emit socket event to the sender
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${request.from.toString()}`).emit('friend_request_declined', {
        from: req.user.userId,
      });
    }

    res.json({
      success: true,
      message: 'Request declined',
    });
  })
);

/**
 * DELETE /api/friends/cancel/:requestId
 * Cancel a sent friend request
 */
router.delete(
  '/cancel/:requestId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    await friendService.cancelRequest(
      req.params.requestId,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Request cancelled',
    });
  })
);

/**
 * DELETE /api/friends/unfriend/:userId
 * Remove a friend
 */
router.delete(
  '/unfriend/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    await friendService.unfriend(req.user.userId, req.params.userId);

    res.json({
      success: true,
      message: 'Friend removed',
    });
  })
);

/**
 * GET /api/friends/requests/incoming
 * List incoming pending friend requests
 */
router.get(
  '/requests/incoming',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const requests = await friendService.getIncomingRequests(req.user.userId);

    res.json({
      success: true,
      data: { requests },
    });
  })
);

/**
 * GET /api/friends/requests/outgoing
 * List outgoing pending friend requests
 */
router.get(
  '/requests/outgoing',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('User not authenticated');

    const requests = await friendService.getOutgoingRequests(req.user.userId);

    res.json({
      success: true,
      data: { requests },
    });
  })
);

export default router;
