
## File 7: `docs/modules/AUTH.md`

```markdown
# Authentication Module

## Overview

JWT-based authentication with RSA-256 signing, refresh token rotation, and TOTP MFA.

## Features

- JWT RS256 (RSA-2048) signing
- Refresh token rotation (each use invalidates previous)
- TOTP Multi-Factor Authentication
- bcrypt password hashing (12 rounds)
- 5 RBAC roles: OWNER, ADMIN, ACCOUNTANT, MANAGER, VIEWER

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Create new user |
| POST | `/v1/auth/login` | Authenticate |
| POST | `/v1/auth/refresh` | Get new tokens |
| POST | `/v1/auth/logout` | Invalidate token |
| GET | `/v1/auth/me` | Get current user |
| POST | `/v1/auth/mfa/setup` | Enable MFA |
| POST | `/v1/auth/mfa/enable` | Verify MFA |
| POST | `/v1/auth/mfa/disable` | Disable MFA |

## Token Structure

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}

interface JwtPayload {
  sub: string;      // User ID
  email: string;
  iat: number;      // Issued at
  exp: number;      // Expires at
}
Role Hierarchy
Role	Level	Permissions
OWNER	5	Full access, delete org
ADMIN	4	Full access except delete org
ACCOUNTANT	3	Financial operations
MANAGER	2	Approve expenses
VIEWER	1	Read-only

USAGE EXAMPLE
// Controller
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Post('admin-only')
adminOnly() {
  return { message: 'Only admins can see this' };
}

// Public route
@Public()
@Get('public')
publicRoute() {
  return { message: 'Anyone can see this' };
}

// Get current user
@Get('profile')
profile(@CurrentUser() user: JwtPayload) {
  return user;
}

// Get organization ID from header
@Get('org-data')
orgData(@OrgId() orgId: string) {
  return { organizationId: orgId };
}

Security Headers
Helmet.js enabled

CORS with credentials

Rate limiting (100 requests per minute)