import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

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
    return this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async getById(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const tenantId = this.requireTenant(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
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
        creditLimit: dto.creditLimit !== undefined ? dto.creditLimit : 0,
        paymentTerms: dto.paymentTerms || 'PREPAID',
        creditStatus: dto.creditStatus || 'GOOD_STANDING',
        currencyCode: dto.currencyCode || 'USD',
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        swiftBic: dto.swiftBic,
        notes: dto.notes,
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
        ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit } : {}),
        ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms } : {}),
        ...(dto.creditStatus !== undefined ? { creditStatus: dto.creditStatus } : {}),
        ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.bankAccountNumber !== undefined ? { bankAccountNumber: dto.bankAccountNumber } : {}),
        ...(dto.swiftBic !== undefined ? { swiftBic: dto.swiftBic } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete(':id')
  async delete(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const tenantId = this.requireTenant(user);
    const existing = await this.prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Customer not found');

    return this.prisma.customer.delete({ where: { id: existing.id } });
  }
}
