import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class MeController {
    private readonly prisma;
    private readonly usersService;
    constructor(prisma: PrismaService, usersService: UsersService);
    getMe(currentUser: CurrentUserData): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            tenantId: string;
            isSuperAdmin: boolean;
            impersonatedTenantId: string;
        };
        permissions: string[];
    }>;
}
