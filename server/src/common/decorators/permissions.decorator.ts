import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';
export const SKIP_PERMISSION_KEY = 'skipPermission';

/**
 * Require specific permission(s) to access an endpoint.
 * User must have ALL specified permissions.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require at least ONE of the given permissions (e.g. the khata is for people who sell, take payments or keep
 * the books). On a controller it covers every route that does not declare its own.
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

/**
 * Skip permission check for this endpoint (e.g., for /me which returns user's own data).
 * The endpoint still requires authentication via JwtAuthGuard.
 * Use sparingly and only for endpoints returning user's own data.
 */
export const SkipPermissionCheck = () => SetMetadata(SKIP_PERMISSION_KEY, true);

