# QaHub API Endpoints Documentation

Base URL: `http://localhost:3001/api/v1`

All endpoints return JSON responses. Error responses follow a consistent format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional: Additional error details
  }
}
```

Success responses follow:
```json
{
  "data": {
    // Response data
  },
  "message": "Optional success message"
}
```

---

## 🔐 Authentication Endpoints

### POST `/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "admin",
      "avatar": null
    },
    "tenant": {
      "id": "1",
      "name": "Default Tenant",
      "slug": "default",
      "plan": "free"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Codes:**
- `INVALID_CREDENTIALS` (401): Invalid email or password
- `ACCOUNT_DISABLED` (403): User account is disabled
- `VALIDATION_ERROR` (400): Invalid input format

---

### GET `/auth/verify`
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "admin",
      "avatar": null
    }
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` (401): No token provided or invalid token
- `UNAUTHORIZED` (401): Invalid or inactive user

---

### POST `/auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Note:** Always returns success message to prevent email enumeration attacks.

**Error Codes:**
- `VALIDATION_ERROR` (400): Invalid email address

---

### GET `/auth/verify-reset-token`
Verify password reset token validity.

**Query Parameters:**
- `token` (string, required): Password reset token

**Response (200 OK):**
```json
{
  "data": {
    "valid": true,
    "email": "user@example.com"
  }
}
```

**Error Codes:**
- `INVALID_TOKEN` (404): Token not found
- `TOKEN_USED` (400): Token has already been used
- `TOKEN_EXPIRED` (400): Token has expired
- `ACCOUNT_DISABLED` (403): User account is disabled

---

### POST `/auth/reset-password`
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "newPassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password has been reset successfully"
}
```

**Error Codes:**
- `INVALID_TOKEN` (404): Token not found
- `TOKEN_USED` (400): Token has already been used
- `TOKEN_EXPIRED` (400): Token has expired
- `PASSWORD_REUSED` (400): Password was recently used (last 5 passwords)
- `USER_NOT_FOUND` (404): User associated with token not found
- `ACCOUNT_DISABLED` (403): User account is disabled
- `VALIDATION_ERROR` (400): Invalid input (password must be at least 8 characters)

**Security Features:**
- Stores old password in password history
- Revokes all personal access tokens
- Updates `passwordChangedAt` timestamp

---

## 👤 User Management Endpoints

### POST `/users/register`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "jobRole": "QA Engineer", // Optional
  "tenantId": "1" // Optional
}
```

**Response (201 Created):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "user@example.com",
      "role": null,
      "avatar": null,
      "jobRole": "QA Engineer",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `USER_EXISTS` (409): User with this email already exists
- `VALIDATION_ERROR` (400): Invalid input format

---

### GET `/users/me`
Get current authenticated user's profile.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "admin",
      "avatar": null,
      "jobRole": "QA Engineer",
      "isActive": true,
      "emailVerifiedAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": "2025-01-01T00:00:00.000Z",
      "passwordChangedAt": null,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "tenants": [
        {
          "id": "1",
          "name": "Default Tenant",
          "slug": "default",
          "plan": "free",
          "status": "active",
          "role": "owner"
        }
      ]
    }
  }
}
```

**Error Codes:**
- `USER_NOT_FOUND` (404): User not found
- `UNAUTHORIZED` (401): Invalid or missing token

---

### PATCH `/users/me`
Update current user's profile.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Updated", // Optional
  "jobRole": "Senior QA Engineer", // Optional
  "avatar": "https://example.com/avatar.jpg" // Optional, or "" to remove
}
```

**Response (200 OK):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Updated",
      "email": "user@example.com",
      "role": "admin",
      "avatar": "https://example.com/avatar.jpg",
      "jobRole": "Senior QA Engineer",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` (400): Invalid input format
- `UNAUTHORIZED` (401): Invalid or missing token

---

### POST `/users/change-password`
Change user's password (requires current password).

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Codes:**
- `INVALID_PASSWORD` (401): Current password is incorrect
- `PASSWORD_REUSED` (400): New password was recently used (last 5 passwords)
- `VALIDATION_ERROR` (400): Invalid input (new password must be at least 8 characters)
- `USER_NOT_FOUND` (404): User not found
- `UNAUTHORIZED` (401): Invalid or missing token

**Security Features:**
- Validates current password
- Checks password history (prevents reuse of last 5 passwords)
- Stores old password in history
- Revokes all personal access tokens
- Updates `passwordChangedAt` timestamp

---

### GET `/users`
List all users (with pagination and filtering).

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by name or email
- `isActive` (boolean, optional): Filter by active status
- `tenantId` (string, optional): Filter by tenant ID

**Example:**
```
GET /users?page=1&limit=20&search=john&isActive=true&tenantId=1
```

**Response (200 OK):**
```json
{
  "data": {
    "users": [
      {
        "id": "1",
        "name": "John Doe",
        "email": "user@example.com",
        "role": "admin",
        "avatar": null,
        "jobRole": "QA Engineer",
        "isActive": true,
        "lastLoginAt": "2025-01-01T00:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` (400): Invalid query parameters
- `UNAUTHORIZED` (401): Invalid or missing token

---

### GET `/users/:id`
Get user by ID.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (string, required): User ID

**Response (200 OK):**
```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "admin",
      "avatar": null,
      "jobRole": "QA Engineer",
      "isActive": true,
      "lastLoginAt": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `USER_NOT_FOUND` (404): User not found
- `UNAUTHORIZED` (401): Invalid or missing token

---

## 🔑 Personal Access Token Endpoints

### POST `/tokens`
Create a new personal access token.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "My API Token",
  "abilities": ["read", "write"], // Optional: Array of permissions
  "expiresAt": "2025-12-31T23:59:59.000Z" // Optional: ISO 8601 datetime
}
```

**Response (201 Created):**
```json
{
  "data": {
    "token": {
      "id": "1",
      "name": "My API Token",
      "token": "abc123...", // Only returned on creation - store securely!
      "abilities": ["read", "write"],
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  },
  "message": "Token created successfully. Store this token securely - it will not be shown again."
}
```

**Note:** The plain token is only returned once on creation. Store it securely!

**Error Codes:**
- `VALIDATION_ERROR` (400): Invalid input format
- `UNAUTHORIZED` (401): Invalid or missing token

---

### GET `/tokens`
List all personal access tokens for current user.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "tokens": [
      {
        "id": "1",
        "name": "My API Token",
        "abilities": ["read", "write"],
        "lastUsedAt": "2025-01-01T00:00:00.000Z",
        "lastUsedIp": "192.168.1.1",
        "lastUsedUserAgent": "Mozilla/5.0...",
        "expiresAt": "2025-12-31T23:59:59.000Z",
        "isExpired": false,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Note:** Only returns non-revoked tokens. Plain token value is never returned after creation.

**Error Codes:**
- `UNAUTHORIZED` (401): Invalid or missing token

---

### GET `/tokens/:id`
Get specific token details.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (string, required): Token ID

**Response (200 OK):**
```json
{
  "data": {
    "token": {
      "id": "1",
      "name": "My API Token",
      "abilities": ["read", "write"],
      "lastUsedAt": "2025-01-01T00:00:00.000Z",
      "lastUsedIp": "192.168.1.1",
      "lastUsedUserAgent": "Mozilla/5.0...",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "isExpired": false,
      "isRevoked": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Codes:**
- `TOKEN_NOT_FOUND` (404): Token not found or doesn't belong to user
- `UNAUTHORIZED` (401): Invalid or missing token

---

### DELETE `/tokens/:id`
Revoke a specific personal access token.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (string, required): Token ID

**Response (200 OK):**
```json
{
  "message": "Token revoked successfully"
}
```

**Error Codes:**
- `TOKEN_NOT_FOUND` (404): Token not found or doesn't belong to user
- `TOKEN_ALREADY_REVOKED` (400): Token is already revoked
- `UNAUTHORIZED` (401): Invalid or missing token

---

### DELETE `/tokens`
Revoke all personal access tokens for current user.

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "5 token(s) revoked successfully"
}
```

**Error Codes:**
- `UNAUTHORIZED` (401): Invalid or missing token

---

### PATCH `/tokens/:id/usage`
Update token usage tracking (IP address and user agent).

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id` (string, required): Token ID

**Request Body:**
```json
{
  "ip": "192.168.1.1", // Optional
  "userAgent": "Mozilla/5.0..." // Optional
}
```

**Response (200 OK):**
```json
{
  "message": "Token usage updated"
}
```

**Note:** This endpoint is typically called automatically when a token is used. IP and user agent are extracted from request headers if not provided.

**Error Codes:**
- `TOKEN_NOT_FOUND` (404): Token not found or doesn't belong to user
- `VALIDATION_ERROR` (400): Invalid input format
- `UNAUTHORIZED` (401): Invalid or missing token

---

## 📊 System Endpoints

### GET `/`
Get API information and available endpoints.

**Response (200 OK):**
```json
{
  "message": "QaHub API Server",
  "version": "v1",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "api": "/api/v1",
    "auth": "/api/v1/auth/login"
  },
  "documentation": "See /api/v1 for API details"
}
```

---

### GET `/health`
Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": "connected"
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": "disconnected"
}
```

---

### GET `/api/v1`
Get API version information and endpoint list.

**Response (200 OK):**
```json
{
  "message": "QaHub API",
  "version": "v1",
  "status": "running",
  "endpoints": {
    "auth": {
      "login": "POST /api/v1/auth/login",
      "register": "POST /api/v1/users/register",
      "verify": "GET /api/v1/auth/verify",
      "forgotPassword": "POST /api/v1/auth/forgot-password",
      "resetPassword": "POST /api/v1/auth/reset-password"
    },
    "users": {
      "me": "GET /api/v1/users/me",
      "updateProfile": "PATCH /api/v1/users/me",
      "changePassword": "POST /api/v1/users/change-password",
      "list": "GET /api/v1/users",
      "getById": "GET /api/v1/users/:id"
    },
    "tokens": {
      "create": "POST /api/v1/tokens",
      "list": "GET /api/v1/tokens",
      "getById": "GET /api/v1/tokens/:id",
      "revoke": "DELETE /api/v1/tokens/:id",
      "revokeAll": "DELETE /api/v1/tokens"
    }
  }
}
```

---

## 🔒 Authentication

Most endpoints require authentication via JWT Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained from:
- `/auth/login` - Returns JWT token on successful login
- `/tokens` - Creates personal access tokens

**Token Expiration:**
- JWT tokens: Configurable via `JWT_EXPIRES_IN` (default: 7 days)
- Personal access tokens: Optional expiration set on creation

---

## 📝 Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional: Additional error details (for validation errors)
  }
}
```

**Common HTTP Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Authentication required or invalid
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## 🔐 Security Features

1. **Password Security:**
   - Passwords hashed with bcrypt (12 rounds)
   - Password history tracking (prevents reuse of last 5)
   - Password reset tokens expire after 1 hour
   - Tokens can only be used once

2. **Token Security:**
   - JWT tokens with configurable expiration
   - Personal access tokens with optional expiration
   - Token revocation on password change
   - Token usage tracking (IP, user agent, last used)

3. **Email Security:**
   - Password reset emails don't reveal if email exists
   - Reset tokens are cryptographically secure (32 bytes)

4. **Authentication:**
   - All protected routes require valid JWT token
   - User status validation (must be active)
   - Token verification on each request

---

## 📚 Additional Resources

- **Frontend Guide:** `apps/web/FRONTEND_GUIDE.md`
- **Client vs Server Components:** `apps/web/docs/CLIENT_VS_SERVER_COMPONENTS.md`
- **Quick Start:** `document/QUICKSTART.md`
- **Development Rules:** `.cursor/rules/DEVELOPMENT_RULES.md`

---

## 🧪 Testing Endpoints

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qahub.com","password":"admin123"}'
```

**Get Profile (with token):**
```bash
curl -X GET http://localhost:3001/api/v1/users/me \
  -H "Authorization: Bearer <your-token>"
```

**Create Token:**
```bash
curl -X POST http://localhost:3001/api/v1/tokens \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My API Token","abilities":["read","write"]}'
```

---

**Last Updated:** 2025-11-30
**API Version:** v1

