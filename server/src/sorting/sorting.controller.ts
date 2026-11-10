import { RequireModule } from '../common/decorators/require-module.decorator';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WasteStage } from '@prisma/client';
import { CurrentUser, CurrentUserData, RequirePermissions, TenantId } from '../common/decorators';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GradeSessionService } from './grade-session.service';
import { SortSessionService } from './sort-session.service';
import {
  AddCategoryKgDto,
  AddGradeKgDto,
  AddWasteDto,
  CloseSessionDto,
  LotQueueQueryDto,
  OutputsQueryDto,
  PageQueryDto,
  StartGradingDto,
  StartSortDto,
  UpdateWasteDto,
} from './sorting.dto';
import { SortingOutputsService } from './sorting-outputs.service';
import { SortingWasteService } from './sorting-waste.service';
import { Idempotent } from '../common/idempotency/idempotent.interceptor';

@RequireModule('SORT')
@Controller('sorting/stage-1')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingStage1Controller {
  constructor(
    private readonly sessions: SortSessionService,
    private readonly waste: SortingWasteService,
  ) {}

  @Get('queue')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  queue(@TenantId() tenantId: string, @Query() query: LotQueueQueryDto) {
    return this.sessions.queue(tenantId, query);
  }

  @Get('productivity')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  productivity(@TenantId() tenantId: string) {
    return this.sessions.productivity(tenantId);
  }

  @Get('summary')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  summaryForLot(@TenantId() tenantId: string, @Query('ragId') ragId: string) {
    return this.sessions.openSummaryForLot(tenantId, ragId);
  }

  @Get('sessions/:id')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  summary(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.sessions.summary(tenantId, id);
  }

  @Idempotent('SORT1_START')
  @Post('start')
  @RequirePermissions('SORTING_STAGE1_CREATE')
  start(@TenantId() tenantId: string, @Body() dto: StartSortDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.start(tenantId, dto, user.userId);
  }

  @Idempotent('SORT1_LINE')
  @Post('allocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SORTING_STAGE1_EDIT')
  allocate(@TenantId() tenantId: string, @Body() dto: AddCategoryKgDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.addKg(tenantId, dto, user.userId);
  }

  @Patch(':id/seal')
  @RequirePermissions('SORTING_STAGE1_CLOSE')
  seal(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CloseSessionDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.close(tenantId, id, user.userId, dto.wasteCategoryId);
  }

  @Idempotent('SORT1_UNDO')
  @Post('unallocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SORTING_STAGE1_EDIT')
  unallocate(@TenantId() tenantId: string, @Body() dto: AddCategoryKgDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.removeKg(tenantId, dto, user.userId);
  }

  /** v2 6.6: kat (put into stock when the lot closed) that nobody will buy. */
  @Idempotent('SORT1_KAT_AWAY')
  @Post('kat/:itemId/throw-away')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SORTING_STAGE1_EDIT')
  throwAwayKat(@TenantId() tenantId: string, @Param('itemId') itemId: string, @CurrentUser() user: CurrentUserData) {
    return this.sessions.throwAwayKat(tenantId, itemId, user.userId);
  }

  @Idempotent('SORT1_WASTE')
  @Post('waste')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async addWaste(@TenantId() tenantId: string, @Body() dto: AddWasteDto) {
    await this.waste.add(tenantId, WasteStage.STAGE_1, dto.sessionId, dto.wasteCategoryId, dto.amount);
    return this.sessions.summary(tenantId, dto.sessionId);
  }

  @Patch('waste/:id')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async updateWaste(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWasteDto) {
    const sessionId = await this.waste.update(tenantId, WasteStage.STAGE_1, id, dto.wasteCategoryId, dto.amount);
    return this.sessions.summary(tenantId, sessionId);
  }

  @Delete('waste/:id')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async removeWaste(@TenantId() tenantId: string, @Param('id') id: string) {
    const sessionId = await this.waste.remove(tenantId, WasteStage.STAGE_1, id);
    return this.sessions.summary(tenantId, sessionId);
  }
}

@RequireModule('SORT')
@Controller('sorting/stage-2')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingStage2Controller {
  constructor(
    private readonly sessions: GradeSessionService,
    private readonly waste: SortingWasteService,
  ) {}

  @Get('queue')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  queue(@TenantId() tenantId: string, @Query() query: PageQueryDto) {
    return this.sessions.queue(tenantId, query);
  }

  @Get('sessions/:id')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  summary(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.sessions.summary(tenantId, id);
  }

  @Idempotent('SORT2_START')
  @Post('start')
  @RequirePermissions('SORTING_STAGE2_CREATE')
  start(@TenantId() tenantId: string, @Body() dto: StartGradingDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.start(tenantId, dto, user.userId);
  }

  @Idempotent('SORT2_LINE')
  @Post('allocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SORTING_STAGE2_EDIT')
  allocate(@TenantId() tenantId: string, @Body() dto: AddGradeKgDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.addKg(tenantId, dto, user.userId);
  }

  @Patch(':id/seal')
  @RequirePermissions('SORTING_STAGE2_CLOSE')
  seal(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CloseSessionDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.close(tenantId, id, user.userId, dto.wasteCategoryId);
  }

  @Idempotent('SORT2_UNDO')
  @Post('unallocate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SORTING_STAGE2_EDIT')
  unallocate(@TenantId() tenantId: string, @Body() dto: AddGradeKgDto, @CurrentUser() user: CurrentUserData) {
    return this.sessions.removeKg(tenantId, dto, user.userId);
  }

  @Idempotent('SORT2_WASTE')
  @Post('waste')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async addWaste(@TenantId() tenantId: string, @Body() dto: AddWasteDto) {
    await this.waste.add(tenantId, WasteStage.STAGE_2, dto.sessionId, dto.wasteCategoryId, dto.amount);
    return this.sessions.summary(tenantId, dto.sessionId);
  }

  @Patch('waste/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async updateWaste(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWasteDto) {
    const sessionId = await this.waste.update(tenantId, WasteStage.STAGE_2, id, dto.wasteCategoryId, dto.amount);
    return this.sessions.summary(tenantId, sessionId);
  }

  @Delete('waste/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async removeWaste(@TenantId() tenantId: string, @Param('id') id: string) {
    const sessionId = await this.waste.remove(tenantId, WasteStage.STAGE_2, id);
    return this.sessions.summary(tenantId, sessionId);
  }
}

@RequireModule('SORT')
@Controller('sorting/outputs')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingOutputsController {
  constructor(private readonly outputs: SortingOutputsService) {}

  @Get()
  @RequirePermissions('SORTING_STAGE2_VIEW')
  findAll(@TenantId() tenantId: string, @Query() query: OutputsQueryDto) {
    return this.outputs.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.outputs.findOne(tenantId, id);
  }
}
