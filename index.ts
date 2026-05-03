import express from 'express';
import http from 'http';
import { getEnvConfig } from './utils/env.js';
import { connectDB, disconnectDB } from './utils/database.js';
import { initializeSocket } from './socket/index.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import {
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
  authLimiter,
  messageLimiter,
  requestLogger,
  sanitizeInput,
} from './middleware/security.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import friendRoutes from './routes/friends.js';
import statusRoutes from './routes/status.js';

const config = getEnvConfig();

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────────────
// MIDDLEWARE SETUP
// ─────────────────────────────────────────────────────────────────────

// Security middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.set('trust proxy', 1);
app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging and sanitization
app.use(requestLogger);
app.use(sanitizeInput);

// ─────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────

// Keep-alive for Render free tier
app.get('/ping', (req, res) => res.send('pong'));

// Health check
app.get(
  '/api/health',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  })
);

// Authentication routes (with stricter rate limiting)
app.use('/api/auth', authLimiter, authRoutes);

// Chat routes
app.use('/api/chats', chatRoutes);

// Message routes (with message rate limiting)
// Routes include both /messages and /chats/:chatId/messages paths
app.use('/api', messageLimiter, messageRoutes);

// User routes
app.use('/api/users', userRoutes);

// Friend routes
app.use('/api/friends', friendRoutes);

// Status (Stories) routes
app.use('/api/status', statusRoutes);

// ─────────────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────────────

app.use((req, res: express.Response) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ─────────────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────
// SOCKET.IO SETUP
// ─────────────────────────────────────────────────────────────────────

const io = initializeSocket(server);

// Make io accessible to route handlers (for emitting socket events from REST endpoints)
app.set('io', io);

// ─────────────────────────────────────────────────────────────────────
// SERVER STARTUP
// ─────────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Start HTTP server
    server.listen(config.PORT, config.HOST, () => {
      console.log(`\n✓ Server running on http://${config.HOST}:${config.PORT}`);
      console.log(`✓ Socket.io listening on ws://${config.HOST}:${config.PORT}`);
      console.log(`✓ Environment: ${config.NODE_ENV}\n`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  console.log(`\n✓ Received ${signal}, shutting down gracefully...`);

  server.close(async () => {
    try {
      await disconnectDB();
      console.log('✓ Server closed');
      process.exit(0);
    } catch (error) {
      console.error('✗ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('✗ Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('✗ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('✗ Uncaught Exception:', error);
  process.exit(1);
});

// Start server
startServer();

export { app, server, io };
