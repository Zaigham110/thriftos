import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ContainerStatus } from '@prisma/client';
import { ContainerService } from './container.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerWeightsDto } from './dto/update-container-weights.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { CreateContainerChargeDto, UpdateContainerChargeDto } from './dto/create-container-charge.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.interceptor';

@Controller('procurement/containers')
@UseGuards(TenantGuard, PermissionGuard)
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Idempotent('CONTAINER_CREATE')
  @Post()
  @RequirePermissions('container.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateContainerDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('container.read')
  async findAll(
    @Query('purchaseOrderId') purchaseOrderId: string,
    @Query('status') status: ContainerStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.findAll(tenantId, { purchaseOrderId, status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('container.read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('container.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContainerDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.update(tenantId, id, dto, user.userId);
  }

  @Patch(':id/weights')
  @RequirePermissions('container.update')
  async updateWeights(
    @Param('id') id: string,
    @Body() dto: UpdateContainerWeightsDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.updateWeights(tenantId, id, dto, user.userId);
  }

  @Patch(':id/status')
  @RequirePermissions('container.update')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContainerStatusDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.updateStatus(tenantId, id, dto, user.userId);
  }

  @Get(':id/cost-breakdown')
  @RequirePermissions('container.read')
  async getCostBreakdown(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.getCostBreakdown(tenantId, id);
  }

  // Charges endpoints
  @Idempotent('CONTAINER_CHARGE')
  @Post(':id/charges')
  @RequirePermissions('container.update')
  @HttpCode(HttpStatus.CREATED)
  async addCharge(
    @Param('id') id: string,
    @Body() dto: CreateContainerChargeDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.addCharge(tenantId, id, dto, user.userId);
  }

  @Get(':id/charges')
  @RequirePermissions('container.read')
  async getCharges(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.getCharges(tenantId, id);
  }

  @Patch(':id/charges/:chargeId')
  @RequirePermissions('container.update')
  async updateCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @Body() dto: UpdateContainerChargeDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.updateCharge(tenantId, id, chargeId, dto, user.userId);
  }

  @Delete(':id/charges/:chargeId')
  @RequirePermissions('container.update')
  @HttpCode(HttpStatus.OK)
  async deleteCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.containerService.deleteCharge(tenantId, id, chargeId, user.userId);
  }
}

