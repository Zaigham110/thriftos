import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadataJson?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadataJson: input.metadataJson,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }

  async findByUser(userId: string, options?: { limit?: number; offset?: number }) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }

  async findByAction(action: string, options?: { tenantId?: string; limit?: number; offset?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        action,
        ...(options?.tenantId && { tenantId: options.tenantId }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }

  async findAll(options?: { limit?: number; offset?: number }) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }
}

