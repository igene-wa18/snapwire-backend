import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { CreateChatSchema, UpdateChatSchema, MarkChatReadSchema, AddGroupMemberSchema } from '../utils/validation.ts';
import { createValidationError } from '../utils/errors.ts';
import * as chatService from '../services/chatService.ts';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/chats
 * Get all chats for authenticated user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = parseInt(req.query.skip as string) || 0;

    const chats = await chatService.getChatList(req.user.userId, limit, skip);

    res.json({
      success: true,
      data: {
        chats,
        limit,
        skip,
      },
    });
  })
);

/**
 * GET /api/chats/:id
 * Get single chat by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const chat = await chatService.getChatById(req.params.id, req.user.userId);

    res.json({
      success: true,
      data: { chat },
    });
  })
);

/**
 * POST /api/chats
 * Create a new chat (1-on-1 or group)
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const result = CreateChatSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { participantIds, isGroup, name, description, groupIcon } = result.data;

    let chat;

    if (isGroup) {
      if (!name) {
        throw createValidationError('Group name is required for group chats');
      }
      chat = await chatService.createGroupChat(
        name,
        participantIds,
        req.user.userId,
        groupIcon,
        description
      );
    } else {
      if (participantIds.length !== 1) {
        throw createValidationError('1-on-1 chat must have exactly one other participant');
      }
      chat = await chatService.findOrCreateDirectChat(req.user.userId, participantIds[0]);
    }

    // Emit socket event to other participants so their chat list updates immediately
    const io = req.app.get('io');
    if (io && chat) {
      chat.participants.forEach((p: any) => {
        const pId = p._id ? p._id.toString() : p.toString();
        if (pId !== req.user!.userId) {
          io.to(pId).emit('chat:new', { chat });
        }
      });
    }

    res.status(201).json({
      success: true,
      data: { chat },
    });
  })
);

/**
 * PATCH /api/chats/:id
 * Update chat metadata (group only)
 */
router.patch(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const result = UpdateChatSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const chat = await chatService.updateGroupMetadata(req.params.id, req.user.userId, result.data);

    res.json({
      success: true,
      data: { chat },
    });
  })
);

/**
 * PATCH /api/chats/:id/read
 * Mark chat as read (reset unread count)
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    await chatService.resetUnreadCount(req.params.id, req.user.userId);

    res.json({
      success: true,
      message: 'Chat marked as read',
    });
  })
);

/**
 * DELETE /api/chats/:id
 * Leave/delete chat
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    await chatService.deleteChat(req.params.id, req.user.userId);

    res.json({
      success: true,
      message: 'Chat deleted',
    });
  })
);

/**
 * POST /api/chats/:id/members
 * Add a member to a group chat
 */
router.post(
  '/:id/members',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const result = AddGroupMemberSchema.safeParse({ chatId: req.params.id, userId: req.body.userId });
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const chat = await chatService.addGroupMember(req.params.id, result.data.userId, req.user.userId);
    
    // We should emit a socket event to the newly added user
    const io = req.app.get('io');
    if (io) {
      // Emit chat:new so it appears in the newly added user's chat list
      io.to(result.data.userId).emit('chat:new', { chat });
      
      // Optionally notify the rest of the group
      io.to(req.params.id).emit('group:updated', chat);
    }

    res.json({
      success: true,
      data: { chat },
    });
  })
);

export default router;
