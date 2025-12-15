import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_KEY = 'superAdmin';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_KEY, true);

