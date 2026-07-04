# Snapwire Backend

A modern, real-time messaging and social networking backend built with Express.js, Socket.io, and MongoDB. Snapwire Backend provides a robust foundation for building instant messaging applications with real-time communication, user presence tracking, and comprehensive social features.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Real-Time Events](#real-time-events)
- [Project Structure](#project-structure)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)
- [License](#license)

## ✨ Features

### Core Messaging
- **One-to-One & Group Chats** - Direct messaging and group conversations
- **Real-Time Messages** - Instant message delivery using Socket.io
- **Message Status Tracking** - Delivered and read receipts
- **Message Replies** - Quote and reply to specific messages
- **Multiple Message Types** - Support for text and other media types

### User Management
- **User Authentication** - JWT-based authentication with secure password hashing
- **User Profiles** - Create and manage user profiles
- **Presence Tracking** - Real-time online/offline status with last seen timestamps
- **User Search** - Find and connect with other users

### Social Features
- **Friend Management** - Add, remove, and manage friends
- **Status/Stories** - Share temporary status updates with followers
- **Group Management** - Create, update, and manage group chats
- **Block & Restrictions** - Block users and manage privacy

### Real-Time Capabilities
- **Live Typing Indicators** - Show when users are typing
- **Real-Time Notifications** - Instant updates for messages and events
- **User Presence Broadcasting** - See who's online across the platform
- **Socket.io Integration** - Efficient WebSocket communication

### Security & Performance
- **Rate Limiting** - Protect against abuse with configurable rate limits
- **Input Sanitization** - Prevent injection attacks
- **CORS Protection** - Secure cross-origin requests
- **Helmet Middleware** - HTTP header security
- **Bcrypt Hashing** - Secure password encryption
- **JWT Tokens** - Stateless authentication

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Real-Time**: Socket.io
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + Bcrypt
- **Validation**: Zod
- **Security**: Helmet, CORS, Rate Limiting
- **Build Tool**: esbuild
- **Development**: TSX (TypeScript execution)

### Dependencies

```json
{
  "axios": "^1.12.0",
  "bcryptjs": "^2.4.3",
  "cookie": "^1.0.2",
  "cors": "^2.8.5",
  "dotenv": "^17.2.2",
  "express": "^4.21.2",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "jsonwebtoken": "^9.0.3",
  "mongoose": "^8.1.1",
  "socket.io": "^4.7.2",
  "zod": "^4.1.12"
}
```

## 📦 Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **Git**

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/igene-wa18/snapwire-backend.git
cd snapwire-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Server Configuration
NODE_ENV=development
PORT=10000

# Database
MONGODB_URI=mongodb://localhost:27017/snapwire
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/snapwire

# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Socket.io CORS
SOCKET_IO_CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Rate Limiting (requests per minute)
RATE_LIMIT_GENERAL=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_MESSAGE=30

# Client URL for notifications/redirects
CLIENT_URL=http://localhost:3000
```

## 🎯 Getting Started

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start on the configured PORT (default: 10000).

### Production Build

Build the project for production:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Database Seeding

Populate your database with sample data:

```bash
npm run seed
```

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

Returns server status and timestamp.

### Authentication Routes (`/api/auth`)

- `POST /register` - Register a new user
- `POST /login` - Login user and receive JWT tokens
- `POST /refresh` - Refresh access token
- `POST /logout` - Logout user

### User Routes (`/api/users`)

- `GET /profile` - Get current user profile
- `GET /:userId` - Get user profile by ID
- `PUT /profile` - Update current user profile
- `GET /search` - Search users by name/email
- `GET /:userId/presence` - Get user's online status

### Chat Routes (`/api/chats`)

- `GET /` - List all user's chats
- `POST /` - Create new chat
- `GET /:chatId` - Get chat details
- `PUT /:chatId` - Update chat
- `DELETE /:chatId` - Delete chat

### Message Routes (`/api/messages` & `/api/chats/:chatId/messages`)

- `GET /chats/:chatId/messages` - Get messages from a chat
- `POST /messages` - Send a message
- `PUT /messages/:messageId` - Update message
- `DELETE /messages/:messageId` - Delete message

### Friend Routes (`/api/friends`)

- `GET /` - List user's friends
- `POST /` - Send friend request
- `PUT /:friendId/accept` - Accept friend request
- `DELETE /:friendId` - Remove friend

### Status Routes (`/api/status`)

- `GET /` - Get status feed
- `POST /` - Create new status
- `DELETE /:statusId` - Delete status

## 🔌 Real-Time Events

### Socket.io Events

#### Connection & Authentication

```javascript
// Automatic JWT auth middleware validates token
// on connection handshake
socket.handshake.auth.token = "your-jwt-token"
```

#### Chat Room Events

```javascript
// Join a specific chat room
socket.emit('chat:join', { chatId: 'chat_id' })

// Leave a chat room
socket.emit('chat:leave', { chatId: 'chat_id' })
```

#### Message Events

```javascript
// Send a message in real-time
socket.emit('message:send', {
  chatId: 'chat_id',
  content: 'Hello!',
  type: 'text',          // or 'image', 'file', etc.
  replyTo: 'message_id', // optional
  tempId: 'temp_123'     // for optimistic updates
})

// Receive new messages
socket.on('message:new', (message) => {
  // { content, sender, chatId, tempId, ... }
})

// Mark message as delivered
socket.emit('message:delivered', {
  messageId: 'msg_id',
  chatId: 'chat_id'
})

// Mark messages as read
socket.emit('message:read', {
  chatId: 'chat_id',
  messageIds: ['msg_id_1', 'msg_id_2']
})

// Listen for message status updates
socket.on('message:status_update', (data) => {
  // { messageId, chatId, status: 'delivered' | 'read', ... }
})
```

#### Typing Indicators

```javascript
// Emit when user starts typing
socket.emit('typing:start', { chatId: 'chat_id' })

// Emit when user stops typing
socket.emit('typing:stop', { chatId: 'chat_id' })

// Listen for typing indicators
socket.on('typing:indicator', (data) => {
  // { chatId, userId, isTyping: true|false }
})
```

#### User Presence

```javascript
// Listen for user online status
socket.on('user:online', (data) => {
  // { userId, isOnline: true }
})

socket.on('user:offline', (data) => {
  // { userId, isOnline: false, lastSeen: Date }
})
```

#### Error Handling

```javascript
// Listen for errors
socket.on('error', (error) => {
  // { code: 'ERROR_CODE', message: 'Error description' }
})
```

## 📁 Project Structure

```
snapwire-backend/
├── index.ts                 # Server entry point
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── 
├── routes/                  # API route handlers
│   ├── auth.ts
│   ├── chats.ts
│   ├── messages.ts
│   ├── users.ts
│   ├── friends.ts
│   └── status.ts
│
├── socket/                  # Socket.io event handlers
│   ├── index.ts             # Main socket setup & message events
│   └── groupEvents.ts       # Group chat events
│
├── services/                # Business logic
│   ├── authService.ts
│   ├── chatService.ts
│   ├── messageService.ts
│   ├── userService.ts
│   ├── friendService.ts
│   └── statusService.ts
│
├── models/                  # MongoDB schemas
│   ├── User.ts
│   ├── Chat.ts
│   ├── Message.ts
│   ├── Friend.ts
│   └── Status.ts
│
├── middleware/              # Express middleware
│   ├── auth.ts              # JWT verification
│   ├── errorHandler.ts      # Error handling
│   └── security.ts          # Security middleware (helmet, cors, rate limit)
│
├── utils/                   # Utility functions
│   ├── database.ts          # MongoDB connection
│   ├── env.ts               # Environment config
│   ├── jwt.ts               # JWT token handling
│   └── validation.ts        # Input validation
│
└── scripts/                 # Utility scripts
    └── seed.ts              # Database seeding
```

## 🔒 Security

### Authentication Flow

1. User registers with email and password
2. Password is hashed using bcryptjs
3. On login, user receives JWT access token and refresh token
4. Access token (short-lived) is used for API requests
5. Refresh token is used to obtain new access tokens

### Security Middleware

- **Helmet**: Secures HTTP headers
- **CORS**: Restricts cross-origin requests to whitelisted origins
- **Rate Limiting**: 
  - General: 100 requests per minute
  - Auth endpoints: 5 requests per minute
  - Message endpoints: 30 requests per minute
- **Input Sanitization**: Prevents injection attacks
- **Trust Proxy**: Correctly identifies client IP for rate limiting

### Best Practices

- Always use HTTPS in production
- Rotate JWT secrets regularly
- Keep environment variables secure
- Validate all user inputs with Zod
- Use strong passwords (enforce in frontend)
- Implement request logging for audit trails

## 👨‍💻 Development

### Code Style

- TypeScript for type safety
- ESLint (if configured)
- Follow existing code patterns

### Adding New Routes

1. Create route handler in `routes/`
2. Create service in `services/` for business logic
3. Create/update model in `models/` if needed
4. Register route in `index.ts`

### Adding Socket.io Events

1. Add event handler in `socket/index.ts` or `socket/groupEvents.ts`
2. Emit events using `io.to(room).emit(event, data)`
3. Update Socket.io event documentation

### Testing

```bash
# Run tests (if configured)
npm test
```

## 🌐 Deployment

### Deployment Platforms

The application is compatible with:
- **Render.com** (Free tier friendly with keep-alive ping)
- **Heroku**
- **AWS/EC2**
- **DigitalOcean**
- **Railway**
- **Fly.io**

### Pre-Deployment Checklist

- [ ] Update `.env` with production values
- [ ] Set `NODE_ENV=production`
- [ ] Use production MongoDB connection string
- [ ] Update `SOCKET_IO_CORS_ORIGIN` with frontend domain
- [ ] Rotate JWT secrets
- [ ] Update `CLIENT_URL` to production domain
- [ ] Run `npm run build`
- [ ] Test health endpoint: `GET /api/health`

### Environment Variables

```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<secure-random-string>
JWT_REFRESH_SECRET=<secure-random-string>
SOCKET_IO_CORS_ORIGIN=https://yourdomain.com
CLIENT_URL=https://yourdomain.com
```

### Docker Deployment (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t snapwire-backend .
docker run -p 10000:10000 --env-file .env snapwire-backend
```

## 📝 License

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the code comments for implementation details

---

**Built with ❤️ by igene-wa18**

Last Updated: 2026
