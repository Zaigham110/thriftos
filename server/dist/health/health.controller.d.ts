import { HealthCheckService, MemoryHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
export declare class HealthController {
    private health;
    private prismaHealth;
    private memory;
    private disk;
    constructor(health: HealthCheckService, prismaHealth: PrismaHealthIndicator, memory: MemoryHealthIndicator, disk: DiskHealthIndicator);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    checkDetailed(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    readiness(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    liveness(): Promise<{
        status: string;
        timestamp: string;
    }>;
}
