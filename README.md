# Synapsis Backend - Authentication & Login

This document explains the authentication architecture and login flow for the Synapsis (formerly ChatApp) backend.

## 🔑 Authentication Architecture

The system uses a robust **JWT (JSON Web Token)** based authentication system featuring a dual-token strategy:
- **Access Tokens**: Short-lived tokens (typically 7 days in this setup) used for authorizing API requests.
- **Refresh Tokens**: Long-lived tokens stored securely to obtain new access tokens without re-authenticating.

## 🚀 Login Flow

### 1. Request
Users send a `POST` request to `/api/auth/login` with:
- `email`
- `password`

### 2. Validation & Verification
1.  **Schema Validation**: The request body is validated using **Zod** to ensure valid email formats and required fields.
2.  **User Lookup**: The system searches for the user in the MongoDB `User` collection.
3.  **Password Hashing**: We use **bcryptjs** to compare the provided plaintext password with the salted/hashed password stored in the database.

### 3. Token Generation
Upon successful verification, the server generates:
- An **AccessToken** containing the `userId`.
- A **RefreshToken** for persistent sessions.

### 4. Response
The server responds with the tokens and basic user data:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "...", "email": "..." },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

## 🔒 Security Features

- **Password Salting**: Passwords are never stored in plaintext. They are hashed using `bcrypt` with a cost factor of 12.
- **Security Headers**: Powered by **Helmet** to protect against common web vulnerabilities.
- **Rate Limiting**: The `/api/auth/login` and `/api/auth/register` endpoints are protected by `authLimiter` to prevent brute-force attacks.
- **Input Sanitization**: Custom middleware trims and cleans all inputs before they reach the controllers.

## 🛠️ Key Files
- `server/routes/auth.ts`: Defines the API endpoints for login/register.
- `server/utils/jwt.ts`: Handles token signing and verification.
- `server/middleware/auth.ts`: Protects other routes by verifying the Bearer token in headers.
- `server/models/User.ts`: The database schema for user accounts.
