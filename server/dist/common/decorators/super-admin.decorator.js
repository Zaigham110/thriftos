"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminOnly = exports.SUPER_ADMIN_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SUPER_ADMIN_KEY = 'superAdmin';
const SuperAdminOnly = () => (0, common_1.SetMetadata)(exports.SUPER_ADMIN_KEY, true);
exports.SuperAdminOnly = SuperAdminOnly;
//# sourceMappingURL=super-admin.decorator.js.map