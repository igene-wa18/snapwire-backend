import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../utils/validation.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { createAuthError, createValidationError, createInternalError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { username, email, password, displayName } = result.data;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      throw createAuthError('User already exists with this email or username');
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      displayName,
      isOnline: false,
      profileCompleted: false,
    });

    await user.save();

    const accessToken = generateAccessToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString(), user.email);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          about: user.about,
          vibe: user.vibe,
          profileCompleted: user.profileCompleted,
        },
        accessToken,
        refreshToken,
        isNewUser: true,
      },
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { email, password } = result.data;

    // Find user and select password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw createAuthError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      throw createAuthError('Invalid email or password');
    }

    const accessToken = generateAccessToken(user._id.toString(), user.email);
    const refreshToken = generateRefreshToken(user._id.toString(), user.email);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          about: user.about,
          vibe: user.vibe,
          profileCompleted: user.profileCompleted,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
        },
        accessToken,
        refreshToken,
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const result = RefreshTokenSchema.safeParse(req.body);
    if (!result.success) {
      throw createValidationError('Invalid input', { errors: result.error.issues });
    }

    const { refreshToken } = result.data;

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.userId);

      if (!user) {
        throw createAuthError('User not found');
      }

      const newAccessToken = generateAccessToken(user._id.toString(), user.email);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      throw createAuthError('Invalid refresh token');
    }
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw createAuthError('User not authenticated');
    }

    const user = await User.findById(req.user.userId)
      .populate('contacts', 'displayName avatar')
      .populate('blockedUsers', '_id');
    if (!user) {
      throw createAuthError('User not found');
    }

    // Count groups for stats
    const groupCount = await Chat.countDocuments({
      participants: user._id,
      isGroup: true,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          about: user.about,
          vibe: user.vibe,
          profileCompleted: user.profileCompleted,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          privacy: user.privacy,
          contacts: user.contacts,
          contactsCount: user.contacts?.length || 0,
          groupsCount: groupCount,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
router.patch(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw createAuthError('User not authenticated');
    }

    const { displayName, avatar, about, vibe, profileCompleted } = req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (about !== undefined) updateData.about = about;
    if (vibe !== undefined) updateData.vibe = vibe;
    if (profileCompleted !== undefined) updateData.profileCompleted = profileCompleted;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true }
    );

    if (!user) {
      throw createAuthError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          about: user.about,
          vibe: user.vibe,
          profileCompleted: user.profileCompleted,
        },
      },
    });
  })
);

/**
 * GET /api/auth/cloudinary-signature
 * Generate a signature for secure client-side Cloudinary uploads
 */
router.get(
  '/cloudinary-signature',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'chatapp/avatars';
    
    const cloudinaryUrl = process.env.CLOUDINARY_URL || '';
    const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    
    if (!match) {
      throw createInternalError('Cloudinary is not properly configured on the server.');
    }
    
    const apiKey = match[1];
    const apiSecret = match[2];
    const cloudName = match[3];

    const strToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    res.json({
      success: true,
      data: {
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder
      }
    });
  })
);

export default router;
