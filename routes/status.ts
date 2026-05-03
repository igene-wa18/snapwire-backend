import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { uploadStatus, getFeed, deleteStatus, markAsViewed } from '../controllers/statusController.ts';

const router = Router();

// All status routes require authentication
router.use(authMiddleware);

// POST /api/status — Upload a new status
router.post('/', asyncHandler(uploadStatus));

// GET /api/status/feed — Get statuses from friends (last 24h)
router.get('/feed', asyncHandler(getFeed));

// DELETE /api/status/:id — Delete own status
router.delete('/:id', asyncHandler(deleteStatus));

// POST /api/status/:id/view — Mark a status as viewed
router.post('/:id/view', asyncHandler(markAsViewed));

export default router;

