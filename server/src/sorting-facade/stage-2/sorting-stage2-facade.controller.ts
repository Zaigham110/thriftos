import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CategoryOutputService } from '../../sorting-stage1/category-output/category-output.service';
import { GradeSessionService } from '../../sorting-stage2/grade-session/grade-session.service';
import { GradeBucketService } from '../../sorting-stage2/grade-bucket/grade-bucket.service';
import { GradeStatus } from '@prisma/client';
import { WasteService } from '../../waste/waste.service';

import { Stage2AddWasteDto, Stage2AllocateDto, Stage2SealDto, Stage2StartDto, Stage2UpdateWasteDto } from './dto';

@Controller('sorting/stage-2')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingStage2FacadeController {
  constructor(
    private readonly categoryOutputService: CategoryOutputService,
    private readonly gradeSessionService: GradeSessionService,
    private readonly gradeBucketService: GradeBucketService,
    private readonly wasteService: WasteService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stage-2 Queue: CategoryOutputs ready for grading (Stage-1 sealed, no GradeSession yet)
   */
  @Get('queue')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async queue(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.categoryOutputService.findAvailableForGrading(tenantId, { page, limit });
  }

  /**
   * Stage-2 Start: create a GradeSession for a CategoryOutput.
   */
  @Post('start')
  @RequirePermissions('SORTING_STAGE2_CREATE')
  @HttpCode(HttpStatus.CREATED)
  async start(@Body() dto: Stage2StartDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const session = await this.gradeSessionService.create(
      tenantId,
      { categoryOutputId: dto.categoryOutputId, workerId: dto.workerId, supervisorId: dto.supervisorId },
      user.userId,
    );

    return this.getSessionSummary(tenantId, session.id);
  }

  /**
   * Stage-2 Allocate: add weight to a grade bucket (aggregated per grade).
   */
  @Post('allocate')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async allocate(@Body() dto: Stage2AllocateDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;

    const amount = Number(dto.amountKg || 0);
    if (!(amount > 0)) {
      return this.getSessionSummary(tenantId, dto.sessionId);
    }

    const existing = await this.prisma.gradeBucket.findUnique({
      where: { gradeSessionId_gradeId: { gradeSessionId: dto.sessionId, gradeId: dto.gradeId } },
      select: { id: true, outputWeightKg: true, outputCount: true },
    });

    if (!existing) {
      await this.gradeBucketService.createForSession(
        tenantId,
        dto.sessionId,
        { gradeId: dto.gradeId, outputWeightKg: amount, outputCount: 0 },
        user.userId,
      );
      return this.getSessionSummary(tenantId, dto.sessionId);
    }

    const newWeight = Number(existing.outputWeightKg || 0) + amount;

    await this.gradeBucketService.update(
      tenantId,
      existing.id,
      { outputWeightKg: newWeight, outputCount: existing.outputCount ?? 0 },
      user.userId,
    );

    return this.getSessionSummary(tenantId, dto.sessionId);
  }

  /**
   * Stage-2 Seal: close GradeSession (creates immutable GradeOutputs).
   */
  @Patch(':id/seal')
  @RequirePermissions('SORTING_STAGE2_CLOSE')
  @HttpCode(HttpStatus.OK)
  async seal(
    @Param('id') sessionId: string,
    @Body() dto: Stage2SealDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.gradeSessionService.close(tenantId, sessionId, user.userId, { wasteCategoryId: dto?.wasteCategoryId });
    return this.getSessionSummary(tenantId, sessionId);
  }

  /**
   * Stage-2 Waste: add an explicit categorized waste line item.
   */
  @Post('waste')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async addWaste(@Body() dto: Stage2AddWasteDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const session = await this.prisma.gradeSession.findFirst({
      where: { id: dto.sessionId, tenantId },
      include: { categoryOutput: { select: { id: true, weightKg: true, ragId: true, containerId: true } } },
    });
    if (!session) throw new BadRequestException('Grade session not found');
    if (session.status !== GradeStatus.OPEN) throw new BadRequestException('Cannot add waste after sealing');

    const totals = await this.prisma.gradeBucket.aggregate({
      where: { gradeSessionId: session.id },
      _sum: { outputWeightKg: true },
    });
    const totalGradeOutputWeight = totals._sum.outputWeightKg ?? new Decimal(0);
    const computedWasteWeight = session.categoryOutput.weightKg.sub(totalGradeOutputWeight);
    if (computedWasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
    }

    const existingWasteAgg = await prismaAny.wasteLineItem.aggregate({
      where: { tenantId, stage: 'STAGE_2', gradeSessionId: session.id },
      _sum: { amount: true },
    });
    const existingWasteAmount = existingWasteAgg._sum.amount ?? new Decimal(0);
    const nextWasteAmount = existingWasteAmount.add(new Decimal(dto.amount ?? 0));
    if (nextWasteAmount.greaterThan(computedWasteWeight)) {
      throw new BadRequestException('Waste amount exceeds available remaining amount');
    }

    await this.wasteService.createLineItem(
      tenantId,
      {
        stage: 'STAGE_2' as any,
        wasteCategoryId: dto.wasteCategoryId,
        amount: dto.amount,
        gradeSessionId: session.id,
      },
      {
        containerId: session.categoryOutput.containerId,
        ragId: session.categoryOutput.ragId,
        categoryOutputId: session.categoryOutput.id,
      },
    );

    return this.getSessionSummary(tenantId, session.id);
  }

  /**
   * Stage-2 Waste: edit an existing waste line item.
   */
  @Patch('waste/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async updateWaste(
    @Param('id') wasteLineItemId: string,
    @Body() dto: Stage2UpdateWasteDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const existing = await prismaAny.wasteLineItem.findFirst({
      where: { id: wasteLineItemId, tenantId, stage: 'STAGE_2' },
      include: { gradeSession: { include: { categoryOutput: { select: { id: true, weightKg: true } } } } },
    });
    if (!existing || !existing.gradeSession) throw new BadRequestException('Waste line item not found');
    if (existing.gradeSession.status !== GradeStatus.OPEN) throw new BadRequestException('Cannot edit waste after sealing');

    const totals = await this.prisma.gradeBucket.aggregate({
      where: { gradeSessionId: existing.gradeSession.id },
      _sum: { outputWeightKg: true },
    });
    const totalGradeOutputWeight = totals._sum.outputWeightKg ?? new Decimal(0);
    const computedWasteWeight = existing.gradeSession.categoryOutput.weightKg.sub(totalGradeOutputWeight);
    if (computedWasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
    }

    const otherWasteAgg = await prismaAny.wasteLineItem.aggregate({
      where: {
        tenantId,
        stage: 'STAGE_2',
        gradeSessionId: existing.gradeSession.id,
        NOT: { id: existing.id },
      },
      _sum: { amount: true },
    });
    const otherWasteAmount = otherWasteAgg._sum.amount ?? new Decimal(0);
    const nextWasteAmount = otherWasteAmount.add(new Decimal(dto.amount ?? 0));
    if (nextWasteAmount.greaterThan(computedWasteWeight)) {
      throw new BadRequestException('Waste amount exceeds available remaining amount');
    }

    await this.wasteService.updateLineItem(tenantId, existing.id, { wasteCategoryId: dto.wasteCategoryId, amount: dto.amount });
    return this.getSessionSummary(tenantId, existing.gradeSession.id);
  }

  /**
   * Stage-2 Waste: remove a waste line item.
   */
  @Delete('waste/:id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async removeWaste(
    @Param('id') wasteLineItemId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const existing = await prismaAny.wasteLineItem.findFirst({
      where: { id: wasteLineItemId, tenantId, stage: 'STAGE_2' },
      select: { id: true, gradeSessionId: true },
    });
    if (!existing || !existing.gradeSessionId) throw new BadRequestException('Waste line item not found');

    const session = await this.prisma.gradeSession.findFirst({
      where: { id: existing.gradeSessionId, tenantId },
      select: { id: true, status: true },
    });
    if (!session) throw new BadRequestException('Grade session not found');
    if (session.status !== GradeStatus.OPEN) throw new BadRequestException('Cannot remove waste after sealing');

    await this.wasteService.deleteLineItem(tenantId, existing.id);
    return this.getSessionSummary(tenantId, session.id);
  }

  private async getSessionSummary(tenantId: string, sessionId: string) {
    const session = await this.prisma.gradeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        categoryOutput: {
          select: {
            id: true,
            weightKg: true,
            allocatedCost: true,
            categoryId: true,
            containerId: true,
            ragId: true,
            sortSessionId: true,
            category: { select: { id: true, name: true } },
            container: { select: { id: true, containerNumber: true } },
            rag: { select: { id: true, ragCode: true } },
          },
        },
      },
    });

    const buckets = await this.prisma.gradeBucket.findMany({
      where: { gradeSessionId: sessionId },
      orderBy: { updatedAt: 'desc' },
      include: { grade: { select: { id: true, name: true } } },
    });

    const prismaAny = this.prisma as any;
    const wasteLineItems = await prismaAny.wasteLineItem.findMany({
      where: { tenantId, stage: 'STAGE_2', gradeSessionId: sessionId },
      orderBy: { updatedAt: 'desc' },
      include: { wasteCategory: true },
    });

    if (!session) return { session: null, buckets, wasteLineItems: [] };

    const inputWeight = session.categoryOutput.weightKg;
    const totalGradeOutputWeight = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), new Decimal(0));
    const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
    const gradeYieldPercent = inputWeight.equals(new Decimal(0))
      ? new Decimal(0)
      : totalGradeOutputWeight.div(inputWeight).mul(new Decimal(100));

    const declaredWasteAmount = wasteLineItems.reduce((sum, li) => sum.add(li.amount), new Decimal(0));
    const remainingWasteAmount = wasteWeight.sub(declaredWasteAmount);

    return {
      session: {
        id: session.id,
        status: session.status,
        categoryOutputId: session.categoryOutputId,
        categoryOutput: session.categoryOutput,
        totalGradeOutputWeight: totalGradeOutputWeight.toString(),
        wasteWeight: wasteWeight.toString(),
        declaredWasteAmount: declaredWasteAmount.toString(),
        remainingWasteAmount: remainingWasteAmount.toString(),
        gradeYieldPercent: gradeYieldPercent.toNumber(),
      },
      buckets,
      wasteLineItems,
    };
  }
}
