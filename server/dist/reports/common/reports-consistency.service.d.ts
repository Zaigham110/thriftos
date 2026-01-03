import { PrismaService } from '../../prisma/prisma.service';
export declare class ReportsConsistencyService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    assertTenantIsReportable(tenantId: string): Promise<void>;
}
