import { Injectable, NotFoundException } from '@nestjs/common';
import { SortStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoryOutputService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: { sortSessionId?: string; categoryId?: string; page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.categoryId && { categoryId: options.categoryId }),
      ...(options?.sortSessionId && { sortCategoryBucket: { sortSessionId: options.sortSessionId } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.categoryOutput.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          sortCategoryBucket: {
            include: {
              sortSession: { select: { id: true, status: true, startTime: true, endTime: true } },
            },
          },
        },
      }),
      this.prisma.categoryOutput.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get category outputs that are available for grading (no GradeSession exists yet)
   * These are outputs from CLOSED Stage 1 sessions that haven't been graded
   */
  async findAvailableForGrading(
    tenantId: string,
    options?: { page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Find category outputs from CLOSED Stage 1 sessions that don't have a grading session
    const where = {
      tenantId,
      gradeSessions: {
        none: {}, // No grade sessions exist for this output
      },
      sortCategoryBucket: {
        is: {
          sortSession: {
            is: {
              status: SortStatus.CLOSED, // Only from closed Stage 1 sessions
            },
          },
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.categoryOutput.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          container: { select: { id: true, containerNumber: true } },
          rag: { select: { id: true, ragCode: true } },
          sortCategoryBucket: {
            include: {
              sortSession: { 
                select: { 
                  id: true, 
                  status: true, 
                  startTime: true, 
                  endTime: true,
                  worker: { select: { id: true, name: true } },
                } 
              },
            },
          },
        },
      }),
      this.prisma.categoryOutput.count({ where }),
    ]);

    return { 
      data, 
      total, 
      page, 
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string) {
    const output = await this.prisma.categoryOutput.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        sortCategoryBucket: {
          include: {
            sortSession: { select: { id: true, status: true, startTime: true, endTime: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!output) throw new NotFoundException('Category output not found');
    return output;
  }
}


