# USER MANAGEMENT & AUTHENTICATION - Missing Features

**Last Updated:** 2025-11-30  
**Status:** In Progress

This document lists all features that need to be added to complete the **USER MANAGEMENT & AUTHENTICATION** section based on `schema.dbml`.

---

## 📊 Quick Summary

### ✅ Fully Implemented (11 features)
1. User registration and profile management
2. Password reset flow (forgot, verify, reset)
3. Password change with history tracking
4. Personal Access Tokens (CRUD operations)
5. JWT authentication
6. User avatar upload/remove
7. Recent activities (basic)
8. Token revocation on password reset/change
9. Token hash storage
10. Basic user search
11. User status filtering

### ⚠️ Partially Implemented (3 features)
1. **Enhanced Token Features** - Hash stored, but auto-tracking missing
2. **User Search/Filtering** - Basic search works, but role/tenant filtering missing
3. **User Activity Tracking** - Only avatar changes tracked, missing other actions

### ❌ Not Implemented (11 features)
1. Email Verification Flow
2. Google OAuth Integration
3. Remember Token Functionality
4. User Deactivation/Reactivation endpoints
5. User Bulk Operations
6. User Export/Import
7. User Preferences/Settings
8. User Invitations
9. Two-Factor Authentication (2FA)
10. Session Management
11. Advanced activity tracking and filtering

---

## ✅ Already Implemented

### Core Features
- ✅ User registration (`POST /users/register`)
- ✅ User profile management (`GET /users/me`, `PATCH /users/me`)
- ✅ User listing with pagination (`GET /users`)
- ✅ User retrieval by ID (`GET /users/:id`)
- ✅ Password change (`POST /users/change-password`)
- ✅ Password reset flow (forgot password, verify token, reset password)
- ✅ Password history tracking (prevents reuse of last 5 passwords)
- ✅ Personal Access Tokens (create, list, revoke, revoke all)
- ✅ JWT authentication
- ✅ User avatar upload/remove (`POST /users/me/avatar`, `DELETE /users/me/avatar`)
- ✅ Recent activities (`GET /users/me/activities`)
- ✅ Token revocation on password reset/change (automatic)
- ✅ Token hash storage (SHA-256)
- ✅ Basic user search (by name/email)
- ✅ Filter users by status (`isActive`)

### Database Tables
- ✅ `users`
- ✅ `password_resets`
- ✅ `password_history`
- ✅ `personal_access_tokens`
- ✅ `audit_logs` (for tracking user activities)

---

## ❌ Missing Features

### 1. **Email Verification Flow** 📧

**Schema Fields:**
- `users.email_verified_at` (timestamp, nullable)

**Missing:**
- [ ] Email verification endpoint (`POST /auth/verify-email`)
- [ ] Send verification email on registration
- [ ] Resend verification email endpoint (`POST /auth/resend-verification`)
- [ ] Email verification token generation and validation
- [ ] Frontend page for email verification (`/verify-email?token=...`)
- [ ] Middleware to check if email is verified (optional enforcement)

**Implementation Notes:**
- Generate verification token (similar to password reset)
- Store token in `password_resets` table or create separate `email_verifications` table
- Send email with verification link
- Update `email_verified_at` when token is verified

---

### 2. **Google OAuth Integration** 🔐

**Schema Fields:**
- `users.google_id` (varchar, unique, nullable)
- `users.google_avatar` (varchar, nullable)
- `users.auth_provider` (varchar, default: 'email')

**Missing:**
- [ ] Google OAuth setup (client ID, client secret)
- [ ] OAuth callback endpoint (`GET /auth/google/callback`)
- [ ] OAuth login endpoint (`GET /auth/google`)
- [ ] Link Google account to existing user (`POST /users/me/link-google`)
- [ ] Unlink Google account (`DELETE /users/me/unlink-google`)
- [ ] Frontend Google login button
- [ ] Handle users who sign up with Google (auto-create account)

**Implementation Notes:**
- Use `passport-google-oauth20` or `google-auth-library`
- Store Google ID and avatar URL
- Set `auth_provider` to 'google' when using Google OAuth
- Allow users to link multiple auth providers

---

### 3. **Remember Token Functionality** 🍪

**Schema Fields:**
- `users.remember_token` (varchar(100), nullable)

**Missing:**
- [ ] Generate remember token on login (if "Remember Me" is checked)
- [ ] Store remember token in database
- [ ] Validate remember token for auto-login
- [ ] Endpoint to refresh remember token
- [ ] Revoke remember token on logout
- [ ] Frontend "Remember Me" checkbox (already exists, but not connected)

**Implementation Notes:**
- Generate secure random token (64+ characters)
- Store hashed version in database
- Set HTTP-only cookie with remember token
- Auto-login user if valid remember token exists

---

### 4. **User Deactivation/Reactivation** 🚫

**Schema Fields:**
- `users.is_active` (boolean, default: true) - Already exists

**Missing:**
- [ ] Deactivate user endpoint (`POST /users/:id/deactivate`) - Admin only
- [ ] Reactivate user endpoint (`POST /users/:id/activate`) - Admin only
- [ ] Bulk deactivate users (`POST /users/bulk-deactivate`) - Admin only
- [ ] Frontend UI for deactivation/reactivation
- [ ] Prevent deactivated users from logging in (already implemented in login endpoint)
- [ ] Audit log entry when user is deactivated/reactivated

**Implementation Notes:**
- Set `is_active = false` to deactivate
- Check `is_active` in login endpoint (already done)
- Add confirmation dialog before deactivation
- Optionally send email notification to user

---

### 5. **Enhanced Personal Access Token Features** 🔑

**Schema Fields (already in `personal_access_tokens`):**
- `token_hash` (varchar(64), unique, nullable) - ✅ **IMPLEMENTED** (stored on creation)
- `last_used_at` (timestamp, nullable) - ⚠️ **PARTIALLY IMPLEMENTED**
- `last_used_ip` (varchar(45), nullable) - ⚠️ **PARTIALLY IMPLEMENTED**
- `last_used_user_agent` (varchar(500), nullable) - ⚠️ **PARTIALLY IMPLEMENTED**

**Status:**
- ✅ Token hash is stored (SHA-256) on token creation
- ✅ Manual token usage update endpoint exists (`PATCH /tokens/:id/usage`)
- ⚠️ **MISSING**: Automatic token usage tracking in auth middleware
- ⚠️ **MISSING**: Display last used information in token list (fields exist but not shown)
- ⚠️ **MISSING**: Filter tokens by last used date
- ⚠️ **MISSING**: Auto-revoke expired tokens (cron job)

**Implementation Notes:**
- ✅ Token hash is already implemented
- ⚠️ Need to add automatic usage tracking in `authenticateToken` middleware
- Need to update token list endpoint to include last used info
- Add cleanup job to revoke expired tokens

---

### 6. **Token Revocation on Password Reset** 🔒

**Schema Notes:**
> "Security best practice: Revoke all personal_access_tokens when password is reset"

**Status:**
- ✅ **IMPLEMENTED**: Revoke all tokens when password is reset (`POST /auth/reset-password`)
- ✅ **IMPLEMENTED**: Revoke all tokens when password is changed (`POST /users/change-password`)
- ⚠️ **MISSING**: Option to keep current session token (optional feature)
- ⚠️ **MISSING**: Notify user about token revocation via email

**Status:** ✅ **Core Feature Implemented** - Token revocation works, but email notification is missing

---

### 7. **User Search and Filtering** 🔍

**Status:**
- ✅ **IMPLEMENTED**: Search users by name or email (`GET /users?search=...`)
- ✅ **IMPLEMENTED**: Filter by status (`GET /users?isActive=true`)
- ⚠️ **MISSING**: Filter by role (`GET /users?role=admin`)
- ⚠️ **MISSING**: Filter by tenant (`GET /users?tenantId=1`) - Schema supports it but not implemented
- ⚠️ **MISSING**: Sort by various fields (name, email, created_at, last_login_at)
- ⚠️ **MISSING**: Advanced search (multiple criteria)

**Status:** ⚠️ **Partially Implemented** - Basic search and status filter exist, but role/tenant filtering and sorting are missing

---

### 8. **User Bulk Operations** 📦

**Missing:**
- [ ] Bulk activate users (`POST /users/bulk-activate`)
- [ ] Bulk deactivate users (`POST /users/bulk-deactivate`)
- [ ] Bulk assign roles (`POST /users/bulk-assign-roles`)
- [ ] Bulk delete users (`DELETE /users/bulk`) - Soft delete
- [ ] Frontend UI for bulk operations (checkboxes, select all)

**Implementation Notes:**
- Accept array of user IDs in request body
- Validate all users exist before processing
- Create audit log entries for each operation
- Return summary of successful/failed operations

---

### 9. **User Export/Import** 📥📤

**Missing:**
- [ ] Export users to CSV (`GET /users/export?format=csv`)
- [ ] Export users to Excel (`GET /users/export?format=xlsx`)
- [ ] Import users from CSV (`POST /users/import`)
- [ ] Import validation and error reporting
- [ ] Template download for import (`GET /users/import-template`)

**Implementation Notes:**
- Use `csv-parser` and `xlsx` libraries
- Validate email uniqueness, required fields
- Return detailed import results (successful, failed, errors)

---

### 10. **User Activity Tracking** 📊

**Schema:**
- `audit_logs` table - Already exists and partially used

**Status:**
- ✅ **IMPLEMENTED**: Track avatar upload/remove (creates audit log entries)
- ✅ **IMPLEMENTED**: User activity timeline for current user (`GET /users/me/activities`)
- ⚠️ **MISSING**: Track all user actions (login, logout, profile update, password change) - Only avatar changes are tracked
- ⚠️ **MISSING**: User activity timeline for other users (`GET /users/:id/activities`)
- ⚠️ **MISSING**: Activity filters (by action, date range, model type)
- ⚠️ **MISSING**: Activity export
- ⚠️ **MISSING**: Real-time activity feed (optional, WebSocket)

**Status:** ⚠️ **Partially Implemented** - Basic activity tracking exists for avatar changes, but comprehensive tracking for all actions is missing

---

### 11. **User Preferences/Settings** ⚙️

**Missing:**
- [ ] User preferences table (or JSON field in users table)
- [ ] Get user preferences (`GET /users/me/preferences`)
- [ ] Update user preferences (`PATCH /users/me/preferences`)
- [ ] Preference categories:
  - Email notifications
  - UI theme (light/dark)
  - Language
  - Timezone
  - Date format
  - Items per page

**Implementation Notes:**
- Add `preferences` JSON field to `users` table
- Validate preference keys and values
- Provide default preferences

---

### 12. **User Invitations** ✉️

**Missing:**
- [ ] Invite user endpoint (`POST /users/invite`)
- [ ] Send invitation email
- [ ] Invitation token generation and validation
- [ ] Accept invitation endpoint (`POST /users/accept-invitation`)
- [ ] Resend invitation (`POST /users/:id/resend-invitation`)
- [ ] List pending invitations (`GET /users/invitations`)
- [ ] Cancel invitation (`DELETE /users/invitations/:id`)

**Implementation Notes:**
- Create `user_invitations` table or use `password_resets` table
- Generate unique invitation token
- Set expiration (e.g., 7 days)
- Auto-create user account when invitation is accepted

---

### 13. **Two-Factor Authentication (2FA)** 🔐

**Missing:**
- [ ] Enable 2FA endpoint (`POST /users/me/enable-2fa`)
- [ ] Disable 2FA endpoint (`POST /users/me/disable-2fa`)
- [ ] Generate QR code for authenticator app
- [ ] Verify 2FA code on login
- [ ] Backup codes generation
- [ ] 2FA recovery flow

**Implementation Notes:**
- Use `speakeasy` or `otplib` for TOTP
- Store 2FA secret in `users` table (encrypted)
- Add `two_factor_enabled` boolean field
- Require 2FA code after password verification

---

### 14. **Session Management** 🪑

**Missing:**
- [ ] List active sessions (`GET /users/me/sessions`)
- [ ] Revoke specific session (`DELETE /users/me/sessions/:id`)
- [ ] Revoke all other sessions (`DELETE /users/me/sessions/others`)
- [ ] Session details (IP, user agent, last activity, location)
- [ ] Frontend session management UI

**Implementation Notes:**
- Track sessions in `personal_access_tokens` or separate `sessions` table
- Store session metadata (IP, user agent, location)
- Update last activity timestamp
- Auto-revoke expired sessions

---

## 📊 Summary

### High Priority (Core Features)
1. ✅ Email Verification Flow
2. ✅ Google OAuth Integration
3. ✅ Remember Token Functionality
4. ✅ User Deactivation/Reactivation

### Medium Priority (Enhanced Features)
5. ✅ Enhanced Personal Access Token Features
6. ✅ User Search and Filtering (advanced)
7. ✅ User Bulk Operations
8. ✅ User Activity Tracking (comprehensive)

### Low Priority (Nice to Have)
9. ✅ User Export/Import
10. ✅ User Preferences/Settings
11. ✅ User Invitations
12. ✅ Two-Factor Authentication
13. ✅ Session Management

---

## 🎯 Recommended Implementation Order

1. **Email Verification** - Essential for production
2. **Remember Token** - Improve UX
3. **User Deactivation** - Admin feature
4. **Enhanced Token Features** - Security improvement
5. **Google OAuth** - Alternative login method
6. **User Bulk Operations** - Admin efficiency
7. **User Activity Tracking** - Audit compliance
8. **User Preferences** - User experience
9. **User Invitations** - Team collaboration
10. **2FA** - Enhanced security
11. **Session Management** - Security feature
12. **Export/Import** - Data management

---

## 📝 Notes

- All new endpoints should follow existing API patterns
- Add audit log entries for all user management operations
- Implement proper authorization checks (admin-only endpoints)
- Add comprehensive error handling and validation
- Update API documentation (`docs/API_ENDPOINTS.md`) for all new endpoints
- Add frontend pages/components for all new features
- Write tests for all new functionality

---

## 🔗 Related Documentation

- [`schema.dbml`](../schema.dbml) - Database schema
- [`docs/API_ENDPOINTS.md`](./API_ENDPOINTS.md) - API documentation
- [`docs/DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) - Development plan
- [`docs/WHY_CLIENT_COMPONENTS.md`](./WHY_CLIENT_COMPONENTS.md) - Architecture notes

