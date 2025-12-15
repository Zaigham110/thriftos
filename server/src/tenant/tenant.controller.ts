import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('tenant')
@UseGuards(TenantGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async getCurrentTenant(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.findOne(tenantId);
  }

  @Get('categories')
  async getCategories(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getCategories(tenantId);
  }

  @Get('grades')
  async getGrades(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getGrades(tenantId);
  }

  @Get('warehouses')
  async getWarehouses(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWarehouses(tenantId);
  }

  @Get('stats')
  async getStats(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getStats(tenantId);
  }
}

