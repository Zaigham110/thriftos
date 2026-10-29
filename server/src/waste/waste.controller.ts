import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipPermissionCheck, TenantId } from '../common/decorators';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { WasteService } from './waste.service';

/** Active waste types for pickers. Managing them lives under /admin/waste-categories. */
@Controller('tenant/waste-categories')
@UseGuards(TenantGuard, PermissionGuard)
export class WasteController {
  constructor(private readonly waste: WasteService) {}

  @Get()
  @SkipPermissionCheck()
  listActive(@TenantId() tenantId: string) {
    return this.waste.listCategories(tenantId);
  }
}
