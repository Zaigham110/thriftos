import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';

/**
 * HealthController - Provides health check endpoints for monitoring.
 * 
 * Security: @Public() - Health checks are accessible without authentication
 * for load balancers, monitoring systems, and orchestration platforms.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
    ]);
  }

  @Get('detailed')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check with all indicators' })
  @ApiResponse({ status: 200, description: 'All services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
  async checkDetailed() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes/orchestration' })
  @ApiResponse({ status: 200, description: 'Service is ready to receive traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
    ]);
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe - simple ping' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
