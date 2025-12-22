import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const SKIP_PERMISSION_KEY = 'skipPermission';

/**
 * Require specific permission(s) to access an endpoint.
 * User must have ALL specified permissions.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Skip permission check for this endpoint (e.g., for /me which returns user's own data).
 * The endpoint still requires authentication via JwtAuthGuard.
 * Use sparingly and only for endpoints returning user's own data.
 */
export const SkipPermissionCheck = () => SetMetadata(SKIP_PERMISSION_KEY, true);

