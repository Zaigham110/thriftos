import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions, TenantId } from '../common/decorators';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { HomeService } from './home.service';

/** Owner home: the numbers the owner looks at, and the list behind each. */
@Controller('home')
@UseGuards(TenantGuard, PermissionGuard)
@RequirePermissions('REPORTS_VIEW')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  summary(@TenantId() tenantId: string) {
    return this.home.summary(tenantId);
  }

  @Get('containers')
  containers(@TenantId() tenantId: string, @Query('limit') limit?: string) {
    return this.home.containers(tenantId, Number(limit) || 10);
  }

  @Get('today')
  today(@TenantId() tenantId: string) {
    return this.home.today(tenantId);
  }

  @Get('stock')
  stock(@TenantId() tenantId: string) {
    return this.home.stockReady(tenantId);
  }
}
