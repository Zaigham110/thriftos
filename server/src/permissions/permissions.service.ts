import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
  }

  async findByGroup() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });

    // Group by group field
    const grouped: Record<string, typeof permissions> = {};
    for (const permission of permissions) {
      if (!grouped[permission.group]) {
        grouped[permission.group] = [];
      }
      grouped[permission.group].push(permission);
    }

    return grouped;
  }

  async findOne(id: string) {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.permission.findUnique({
      where: { code },
    });
  }
}

