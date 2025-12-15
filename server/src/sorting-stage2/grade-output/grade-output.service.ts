import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GradeOutputService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: { gradeSessionId?: string; gradeId?: string; page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.gradeId && { gradeId: options.gradeId }),
      ...(options?.gradeSessionId && { gradeBucket: { gradeSessionId: options.gradeSessionId } }),
    };

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
                  categoryOutput: { select: { id: true, categoryId: true, weightKg: true, allocatedCost: true } },
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
                categoryOutput: { select: { id: true, categoryId: true, weightKg: true, allocatedCost: true } },
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


