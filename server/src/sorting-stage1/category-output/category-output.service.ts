import { Injectable, NotFoundException } from '@nestjs/common';
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


