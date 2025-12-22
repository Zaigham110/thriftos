import { SequenceScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export interface SequenceFormatOptions {
    prefix?: string;
    padSize?: number;
    includeYear?: boolean;
    delimiter?: string;
    suffix?: string;
    yearOverride?: number;
}
export declare class TenantSequenceService {
    private prisma;
    constructor(prisma: PrismaService);
    next(tenantId: string, scope: SequenceScope): Promise<number>;
    formatCode(sequence: number, options?: SequenceFormatOptions): string;
    generateCode(tenantId: string, scope: SequenceScope, options?: SequenceFormatOptions, uniquenessCheck?: (code: string) => Promise<boolean>): Promise<{
        code: string;
        sequence: number;
    }>;
}
