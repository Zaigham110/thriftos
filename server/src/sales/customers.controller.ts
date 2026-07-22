import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { VendorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(user: CurrentUserData): string {
    const tenantId = user?.impersonatedTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    return tenantId;
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserData) {
    const tenantId = this.requireTenant(user);

    // Clean up any legacy auto-created dummy records if present
    await this.prisma.customer.deleteMany({
      where: {
        tenantId,
        name: { in: ['General Wholesale Buyer', 'Walk-in Retail Buyer'] },
      },
    });

    const [customers, vendors] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.findMany({
        where: { tenantId, isActive: true, vendorType: VendorType.CUSTOMER },
        orderBy: { name: 'asc' },
      }),
    ]);

    const vendorAsCustomers = vendors.map((v) => ({
      id: v.id,
      tenantId: v.tenantId,
      name: v.name,
      companyName: v.name,
      billingAddress: v.contactInfo || 'Standard Billing Address',
      shippingAddress: v.contactInfo || 'Standard Shipping Address',
      contactEmail: `${v.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@vendor.com`,
      contactPhone: v.contactInfo || '',
      taxId: null,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    const customerIds = new Set(customers.map((c) => c.id));
    const combined = [...customers];
    for (const v of vendorAsCustomers) {
      if (!customerIds.has(v.id)) {
        combined.push(v as any);
      }
    }

    return combined;
  }

  @Get(':id')
  async get(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const tenantId = this.requireTenant(user);
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  @Post()
  async create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateCustomerDto) {
    const tenantId = this.requireTenant(user);
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        companyName: dto.companyName,
        billingAddress: dto.billingAddress,
        shippingAddress: dto.shippingAddress,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        taxId: dto.taxId,
      },
    });
  }

  @Patch(':id')
  async update(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const tenantId = this.requireTenant(user);

    const existing = await this.prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Customer not found');

    return this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.billingAddress !== undefined ? { billingAddress: dto.billingAddress } : {}),
        ...(dto.shippingAddress !== undefined ? { shippingAddress: dto.shippingAddress } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
