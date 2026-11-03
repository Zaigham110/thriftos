import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toE164 } from '../common/phone/phone';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';
import { KhataService } from './khata.service';

/** Customers (gahak). Only the name and phone are required; the phone is their WhatsApp number. */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khata: KhataService,
  ) {}

  list(tenantId: string, query: CustomersQueryDto) {
    const search = query.search?.trim();
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search.replace(/\D/g, '') || search } }, { city: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(tenantId: string, dto: CreateCustomerDto, userId: string) {
    const customer = await this.unique(() =>
      this.prisma.customer.create({
        data: {
          tenantId,
          ...this.fields(dto),
          name: dto.name.trim(),
          openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
        },
      }),
    );
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: customer.id,
        metadataJson: { openingBalance: customer.openingBalance.toFixed(2) },
      },
    });
    return customer;
  }

  /** A change to the opening balance re-applies payments, so sale statuses stay right. */
  async update(tenantId: string, id: string, dto: UpdateCustomerDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.khata.lockCustomer(tx, tenantId, id);
      const before = await tx.customer.findUniqueOrThrow({ where: { id } });
      const customer = await this.unique(() =>
        tx.customer.update({
          where: { id },
          data: {
            ...this.fields(dto),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.openingBalance !== undefined ? { openingBalance: new Prisma.Decimal(dto.openingBalance) } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        }),
      );
      if (!customer.openingBalance.equals(before.openingBalance)) {
        await this.khata.refreshStatusesTx(tx, tenantId, id);
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'CUSTOMER_OPENING_BALANCE_CHANGED',
            entityType: 'Customer',
            entityId: id,
            metadataJson: { previous: before.openingBalance.toFixed(2), new: customer.openingBalance.toFixed(2) },
          },
        });
      }
      return customer;
    });
  }

  /** Only a customer with no sales or payments can be deleted; others are made inactive. */
  async remove(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      select: { id: true, _count: { select: { sales: true, payments: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer._count.sales || customer._count.payments) {
      throw new ConflictException('This customer has sales or payments. Mark them inactive instead.');
    }
    return this.prisma.customer.delete({ where: { id } });
  }

  /** Optional fields, plus the phone read as a WhatsApp number. */
  private fields(dto: CreateCustomerDto | UpdateCustomerDto) {
    const optional = ['city', 'notes', 'companyName', 'billingAddress', 'shippingAddress', 'contactEmail', 'taxId'] as const;
    const data: Prisma.CustomerUncheckedUpdateInput = {};
    for (const field of optional) {
      if (dto[field] !== undefined) data[field] = dto[field]?.trim() || null;
    }
    if (dto.creditLimit !== undefined) data.creditLimit = new Prisma.Decimal(dto.creditLimit);
    if (dto.phone !== undefined) {
      const phone = toE164(dto.phone);
      if (!phone) throw new BadRequestException('Phone number is not valid');
      data.phone = phone;
    }
    return data as Omit<Prisma.CustomerUncheckedCreateInput, 'tenantId' | 'name'>;
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A customer with this name already exists');
      }
      throw e;
    }
  }
}
