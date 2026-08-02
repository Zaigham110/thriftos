import {
  Controller,
  Get,
  Post,
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
import { RagService } from './rag.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RagStatus } from '@prisma/client';

@Controller('procurement')
@UseGuards(TenantGuard, PermissionGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('containers/:containerId/rags')
  @RequirePermissions('rag.create')
  @HttpCode(HttpStatus.CREATED)
  async createForContainer(
    @Param('containerId') containerId: string,
    @Body() dto: Omit<CreateRagDto, 'containerId'>,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.create(tenantId, { ...dto, containerId }, user.userId);
  }

  @Post('rags')
  @RequirePermissions('rag.create')
  @HttpCode(HttpStatus.CREATED)
  async createLooseRag(
    @Body() dto: CreateRagDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.createIdempotent(tenantId, dto, user.userId, req.header('idempotency-key'));
  }

  @Post('loose-bales')
  @RequirePermissions('rag.create')
  @HttpCode(HttpStatus.CREATED)
  async createLooseBale(
    @Body() dto: CreateRagDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.create(tenantId, { ...dto, ragBaleType: dto.ragBaleType || 'BALE' }, user.userId);
  }

  /**
   * Get all rags for a tenant.
   * 
   * Phase 2.5: Supports status filtering for sorting workflow.
   * - status: Filter by RagStatus (NOT_STARTED, IN_SORTING, SORTED)
   * - sortableOnly: When 'true', returns only NOT_STARTED rags available for sorting
   */
  @Get('rags')
  @RequirePermissions('rag.read')
  async findAll(
    @Query('containerId') containerId: string,
    @Query('status') status: RagStatus,
    @Query('sortableOnly') sortableOnly: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.findAll(tenantId, {
      containerId,
      status,
      sortableOnly: sortableOnly === 'true',
      page,
      limit,
    });
  }

  @Get('rags/:id')
  @RequirePermissions('rag.read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.findOne(tenantId, id);
  }

  @Delete('rags/:id')
  @RequirePermissions('rag.delete')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.ragService.delete(tenantId, id, user.userId);
  }
}
