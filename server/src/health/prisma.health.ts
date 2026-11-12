import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthIndicatorService,
  ) {}

  /** Up when the database answers; down (the health check then answers 503) when it does not. */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const check = this.health.check(key);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return check.up({ message: 'Database connection successful' });
    } catch (error) {
      return check.down({ message: error instanceof Error ? error.message : 'Database not reachable' });
    }
  }
}
