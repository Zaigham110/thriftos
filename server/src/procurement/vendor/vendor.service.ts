import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateVendorDto, userId: string) {
    // Check for duplicate name
    const existing = await this.prisma.vendor.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Vendor "${dto.name}" already exists`);
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        tenantId,
        name: dto.name,
        country: dto.country,
        contactInfo: dto.contactInfo,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'VENDOR_CREATED',
      entityType: 'Vendor',
      entityId: vendor.id,
      metadataJson: { vendorName: vendor.name },
    });

    return vendor;
  }

  async findAll(tenantId: string, includeInactive = false) {
    return this.prisma.vendor.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async update(tenantId: string, id: string, dto: Partial<CreateVendorDto>, userId: string) {
    const vendor = await this.findOne(tenantId, id);

    // Check for duplicate name if changing
    if (dto.name && dto.name !== vendor.name) {
      const existing = await this.prisma.vendor.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });

      if (existing) {
        throw new BadRequestException(`Vendor "${dto.name}" already exists`);
      }
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'VENDOR_UPDATED',
      entityType: 'Vendor',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }
}

