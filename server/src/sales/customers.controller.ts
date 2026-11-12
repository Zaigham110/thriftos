import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData, TenantId } from '../common/decorators';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequireAnyPermission } from '../common/decorators/permissions.decorator';
import { SEE_SALES, WORK_CUSTOMERS } from './sales-access';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';
import { Idempotent } from '../common/idempotency/idempotent.interceptor';

/** Customers are for people who sell, take payments or keep the books; changing one needs selling or payments (audit H1/H2). */
@Controller('customers')
@UseGuards(TenantGuard, PermissionGuard)
@RequireAnyPermission(...SEE_SALES)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query() query: CustomersQueryDto) {
    return this.customers.list(tenantId, query);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.customers.get(tenantId, id);
  }

  @Idempotent('CUSTOMER_CREATE')
  @Post()
  @RequireAnyPermission(...WORK_CUSTOMERS)
  create(@TenantId() tenantId: string, @Body() dto: CreateCustomerDto, @CurrentUser() user: CurrentUserData) {
    return this.customers.create(tenantId, dto, user.userId);
  }

  @Patch(':id')
  @RequireAnyPermission(...WORK_CUSTOMERS)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: CurrentUserData) {
    return this.customers.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequireAnyPermission(...WORK_CUSTOMERS)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.customers.remove(tenantId, id);
  }
}
