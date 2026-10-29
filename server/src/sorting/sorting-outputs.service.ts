import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Graded stock (grade outputs) for lists, detail and tracing. */
@Injectable()
export class SortingOutputsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: {
      gradeSessionId?: string;
      gradeId?: string;
      status?: string;
      search?: string;
      ragCode?: string;
      containerNumber?: string;
      categoryId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const search = (options?.search ?? '').trim();
    const ragCode = (options?.ragCode ?? '').trim();
    const containerNumber = (options?.containerNumber ?? '').trim();

    const where: any = {
      tenantId,
      ...(options?.gradeId && { gradeId: options.gradeId }),
      ...(options?.gradeSessionId && { gradeBucket: { gradeSessionId: options.gradeSessionId } }),
      ...(options?.status && { status: options.status as any }),
      ...(options?.categoryId && {
        gradeBucket: {
          ...(options?.gradeSessionId ? { gradeSessionId: options.gradeSessionId } : {}),
          gradeSession: { categoryOutput: { categoryId: options.categoryId } },
        },
      }),
    };

    // Text search / tracing filters (contains, case-insensitive)
    const or: any[] = [];
    if (search) {
      // Support searching by output id fragment and grade name and traceability fields.
      or.push(
        { id: { contains: search, mode: 'insensitive' } },
        { grade: { name: { contains: search, mode: 'insensitive' } } },
        {
          gradeBucket: {
            gradeSession: {
              categoryOutput: {
                rag: { ragCode: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        },
        {
          gradeBucket: {
            gradeSession: {
              categoryOutput: {
                container: { containerNumber: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        },
        {
          gradeBucket: {
            gradeSession: {
              categoryOutput: {
                category: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        },
      );
    }

    if (ragCode) {
      or.push({
        gradeBucket: {
          gradeSession: {
            categoryOutput: {
              rag: { ragCode: { contains: ragCode, mode: 'insensitive' } },
            },
          },
        },
      });
    }

    if (containerNumber) {
      or.push({
        gradeBucket: {
          gradeSession: {
            categoryOutput: {
              container: { containerNumber: { contains: containerNumber, mode: 'insensitive' } },
            },
          },
        },
      });
    }

    if (or.length) {
      where.AND = [...(where.AND ?? []), { OR: or }];
    }

    const [data, total] = await Promise.all([
      this.prisma.gradeOutput.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          grade: { select: { id: true, name: true } },
          gradeBucket: {
            include: {
              gradeSession: {
                include: {
                  categoryOutput: {
                    select: {
                      id: true,
                      categoryId: true,
                      ragId: true,
                      containerId: true,
                      sortSessionId: true,
                      weightKg: true,
                      allocatedCost: true,
                      category: { select: { id: true, name: true } },
                      rag: { select: { id: true, ragCode: true } },
                      container: { select: { id: true, containerNumber: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.gradeOutput.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const output = await this.prisma.gradeOutput.findFirst({
      where: { id, tenantId },
      include: {
        grade: { select: { id: true, name: true } },
        gradeBucket: {
          include: {
            grade: { select: { id: true, name: true } },
            gradeSession: {
              include: {
                categoryOutput: {
                  select: {
                    id: true,
                    categoryId: true,
                    ragId: true,
                    containerId: true,
                    sortSessionId: true,
                    weightKg: true,
                    allocatedCost: true,
                    category: { select: { id: true, name: true } },
                    rag: { select: { id: true, ragCode: true } },
                    container: { select: { id: true, containerNumber: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!output) throw new NotFoundException('Grade output not found');
    return output;
  }
}
