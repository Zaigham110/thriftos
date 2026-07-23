import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateVendorDto, userId: string) {
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
        companyName: dto.companyName,
        vendorType: dto.vendorType || 'SUPPLIER',
        country: dto.country,
        taxId: dto.taxId,
        contactPerson: dto.contactPerson,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        contactInfo: dto.contactInfo,
        paymentTerms: dto.paymentTerms || 'NET_30',
        defaultCurrency: dto.defaultCurrency || 'USD',
        remittanceAccount: dto.remittanceAccount,
        physicalAddress: dto.physicalAddress,
        notes: dto.notes,
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

  async update(tenantId: string, id: string, dto: UpdateVendorDto, userId: string) {
    const vendor = await this.findOne(tenantId, id);

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
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.vendorType !== undefined && { vendorType: dto.vendorType }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.contactInfo !== undefined && { contactInfo: dto.contactInfo }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
        ...(dto.defaultCurrency !== undefined && { defaultCurrency: dto.defaultCurrency }),
        ...(dto.remittanceAccount !== undefined && { remittanceAccount: dto.remittanceAccount }),
        ...(dto.physicalAddress !== undefined && { physicalAddress: dto.physicalAddress }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
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

  async remove(tenantId: string, id: string, userId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { purchaseOrders: true, incomingBales: true },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const hasReferences = vendor._count.purchaseOrders > 0 || vendor._count.incomingBales > 0;
    if (hasReferences) {
      throw new BadRequestException(
        'Cannot delete vendor: it is referenced by procurement history. Deactivate instead.'
      );
    }

    await this.prisma.vendor.delete({ where: { id } });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'VENDOR_DELETED',
      entityType: 'Vendor',
      entityId: id,
      metadataJson: { vendorName: vendor.name },
    });

    return { id, deleted: true };
  }
}
