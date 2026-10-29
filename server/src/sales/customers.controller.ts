import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserData, TenantId } from '../common/decorators';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
@UseGuards(TenantGuard)
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

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateCustomerDto, @CurrentUser() user: CurrentUserData) {
    return this.customers.create(tenantId, dto, user.userId);
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: CurrentUserData) {
    return this.customers.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.customers.remove(tenantId, id);
  }
}
