"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipPermissionCheck = exports.RequirePermissions = exports.SKIP_PERMISSION_KEY = exports.PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PERMISSIONS_KEY = 'permissions';
exports.SKIP_PERMISSION_KEY = 'skipPermission';
const RequirePermissions = (...permissions) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions);
exports.RequirePermissions = RequirePermissions;
const SkipPermissionCheck = () => (0, common_1.SetMetadata)(exports.SKIP_PERMISSION_KEY, true);
exports.SkipPermissionCheck = SkipPermissionCheck;
//# sourceMappingURL=permissions.decorator.js.map