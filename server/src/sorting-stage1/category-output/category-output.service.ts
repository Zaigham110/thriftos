import { Injectable, NotFoundException } from '@nestjs/common';
import { GradeStatus, SortStatus } from '@prisma/client';
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
   * Get category outputs that are available for grading OR have in-progress grading
   * These are outputs from CLOSED Stage 1 sessions that:
   * - Haven't been graded yet (no GradeSession), OR
   * - Have an OPEN GradeSession (in-progress)
   */
  async findAvailableForGrading(
    tenantId: string,
    options?: { page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Find category outputs from CLOSED Stage 1 sessions that:
    // - Have no grade sessions (NOT_STARTED), OR
    // - Have an OPEN grade session (IN_PROGRESS)
    const where = {
      tenantId,
      sortCategoryBucket: {
        is: {
          sortSession: {
            is: {
              status: SortStatus.CLOSED, // Only from closed Stage 1 sessions
            },
          },
        },
      },
      OR: [
        { gradeSessions: { none: {} } }, // No grade sessions
        { gradeSessions: { some: { status: GradeStatus.OPEN } } }, // Has OPEN grade session
      ],
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
          gradeSessions: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
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

    // Add gradeStatus field to each item
    const dataWithStatus = data.map((item) => {
      let gradeStatus = 'NOT_STARTED';
      if (item.gradeSessions && item.gradeSessions.length > 0) {
        gradeStatus = item.gradeSessions[0].status === 'OPEN' ? 'IN_PROGRESS' : 'GRADED';
      }
      return { ...item, gradeStatus };
    });

    // Sort by gradeStatus (IN_PROGRESS first, then NOT_STARTED)
    dataWithStatus.sort((a, b) => {
      if (a.gradeStatus === 'IN_PROGRESS' && b.gradeStatus !== 'IN_PROGRESS') return -1;
      if (a.gradeStatus !== 'IN_PROGRESS' && b.gradeStatus === 'IN_PROGRESS') return 1;
      return 0;
    });

    return { 
      data: dataWithStatus, 
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


