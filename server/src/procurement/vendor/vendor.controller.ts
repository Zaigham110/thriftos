import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.interceptor';

@Controller('procurement/vendors')
@UseGuards(TenantGuard, PermissionGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @Idempotent('VENDOR_CREATE')
  @RequirePermissions('po.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.vendorService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('po.read')
  async findAll(
    @Query('includeInactive') includeInactive: boolean,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.vendorService.findAll(tenantId, includeInactive);
  }
}

