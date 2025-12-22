export declare const PERMISSIONS_KEY = "permissions";
export declare const SKIP_PERMISSION_KEY = "skipPermission";
export declare const RequirePermissions: (...permissions: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const SkipPermissionCheck: () => import("@nestjs/common").CustomDecorator<string>;
