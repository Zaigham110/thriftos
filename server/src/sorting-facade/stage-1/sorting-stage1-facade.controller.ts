import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

import { RagService } from '../../procurement/rag/rag.service';
import { IncomingBaleService } from '../../procurement/incoming-bale/incoming-bale.service';
import { SortSessionService } from '../../sorting-stage1/sort-session/sort-session.service';
import { SortCategoryBucketService } from '../../sorting-stage1/sort-category-bucket/sort-category-bucket.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RagStatus, SortStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WasteService } from '../../waste/waste.service';

import { Stage1AddWasteDto, Stage1AllocateDto, Stage1SealDto, Stage1StartDto, Stage1UpdateWasteDto } from './dto';

@Controller('sorting/stage-1')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingStage1FacadeController {
  constructor(
    private readonly ragService: RagService,
    private readonly incomingBaleService: IncomingBaleService,
    private readonly sortSessionService: SortSessionService,
    private readonly bucketService: SortCategoryBucketService,
    private readonly wasteService: WasteService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stage-1 Queue: Rag/Bales ready for sorting (NOT_STARTED only)
   * 
   * Phase 2.5 Corrections:
   * - Returns BOTH rags AND loose bales
   * - Unified response with sourceType ('RAG' or 'LOOSE_BALE')
   * - Includes both NOT_STARTED and IN_SORTING items (shows in-progress work)
   */
  @Get('queue')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async queue(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('status') status: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const pageNum = page || 1;
    const limitNum = limit || 20;

    // Fetch rags - include both NOT_STARTED and IN_SORTING
    // If status filter provided, use it; otherwise show both
    const ragStatusFilter = status ? (status as RagStatus) : undefined;
    const ragsResult = await this.ragService.findAll(tenantId, { 
      status: ragStatusFilter,
      page: pageNum, 
      limit: limitNum 
    });

    // Filter to only NOT_STARTED and IN_SORTING rags (exclude SORTED)
    const filteredRags = ragStatusFilter 
      ? ragsResult.data 
      : ragsResult.data.filter(r => r.status === 'NOT_STARTED' || r.status === 'IN_SORTING');

    // Fetch loose bales with OPEN sortSessions (IN_SORTING) or no sortSessions (NOT_STARTED)
    const balesWhere = {
      tenantId,
      purchaseOrderId: { not: null },
      purchaseOrder: {
        is: {
          status: { not: 'CLOSED' as const },
        },
      },
      // Include bales with no sessions OR with OPEN sessions
      OR: [
        { sortSessions: { none: {} } },
        { sortSessions: { some: { status: SortStatus.OPEN } } },
      ],
    };

    const [balesData, balesTotal] = await Promise.all([
      this.prisma.incomingBale.findMany({
        where: balesWhere,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
          rawCategory: {
            select: { id: true, name: true, rawType: true },
          },
          sortSessions: {
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.incomingBale.count({ where: balesWhere }),
    ]);

    // Combine results with sourceType indicator
    const combinedData = [
      ...filteredRags.map((rag) => ({
        ...rag,
        sourceType: 'RAG',
        sourceId: rag.id,
      })),
      ...balesData.map((bale) => {
        // Derive status from sortSessions for loose bales
        let status = 'NOT_STARTED';
        if (bale.sortSessions && bale.sortSessions.length > 0) {
          const latestSession = bale.sortSessions[0];
          status = latestSession.status === 'CLOSED' ? 'SORTED' : 'IN_SORTING';
        }
        return {
          ...bale,
          sourceType: 'LOOSE_BALE',
          sourceId: bale.id,
          status,
        };
      }),
    ];

    // Sort by status (IN_SORTING first, then NOT_STARTED)
    combinedData.sort((a, b) => {
      if (a.status === 'IN_SORTING' && b.status !== 'IN_SORTING') return -1;
      if (a.status !== 'IN_SORTING' && b.status === 'IN_SORTING') return 1;
      return 0;
    });

    const totalCount = filteredRags.length + balesTotal;

    return {
      data: combinedData,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
    };
  }

  /** Read-only resume context for an already-open category-sort session. */
  @Get('sessions/:id')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async sessionSummary(
    @Param('id') sessionId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.getSessionSummary(tenantId, sessionId);
  }

  /**
   * Stage-1 Summary: fetch current OPEN sort session + buckets for a rag (used to resume).
   */
  @Get('summary')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async summary(
    @Query('ragId') ragId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const session = await this.prisma.sortSession.findFirst({
      where: {
        tenantId,
        status: SortStatus.OPEN,
        OR: [
          { ragId },
          { incomingBaleId: ragId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!session) return { session: null, buckets: [] };
    return this.getSessionSummary(tenantId, session.id);
  }

  /**
   * Stage-1 Start: create session for ragId or incomingBaleId and transition to IN_SORTING.
   * 
   * Phase 2.5 Corrections:
   * - Supports both ragId and incomingBaleId
   * - Loose bales can now be sorted alongside rags
   */
  @Post('start')
  @RequirePermissions('SORTING_STAGE1_CREATE')
  @HttpCode(HttpStatus.CREATED)
  async start(@Body() dto: Stage1StartDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const session = await this.sortSessionService.create(
      tenantId,
      { 
        ragId: dto.ragId, 
        incomingBaleId: dto.incomingBaleId, 
        workerId: dto.workerId, 
        supervisorId: dto.supervisorId 
      },
      user.userId,
    );

    return this.getSessionSummary(tenantId, session.id);
  }

  /**
   * Stage-1 Allocate: add weight to a category bucket (aggregated per category).
   * Immediate non-over-allocation is enforced via existing bucket recompute.
   */
  @Post('allocate')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async allocate(@Body() dto: Stage1AllocateDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;

    const amount = Number(dto.amountKg || 0);
    if (!(amount > 0)) {
      return this.getSessionSummary(tenantId, dto.sessionId);
    }

    const existing = await this.prisma.sortCategoryBucket.findUnique({
      where: { sortSessionId_categoryId: { sortSessionId: dto.sessionId, categoryId: dto.categoryId } },
      select: { id: true, outputWeightKg: true, outputCount: true },
    });

    const count = Number(dto.outputCount || 0);

    if (!existing) {
      await this.bucketService.createForSession(
        tenantId,
        dto.sessionId,
        { categoryId: dto.categoryId, outputWeightKg: amount, outputCount: count },
        user.userId,
      );
      return this.getSessionSummary(tenantId, dto.sessionId);
    }

    const newWeight = Number(existing.outputWeightKg || 0) + amount;
    const newCount = Number(existing.outputCount || 0) + count;

    await this.bucketService.update(
      tenantId,
      existing.id,
      { outputWeightKg: newWeight, outputCount: newCount },
      user.userId,
    );

    return this.getSessionSummary(tenantId, dto.sessionId);
  }

  /**
   * Stage-1 Seal: close sort session (creates immutable CategoryOutputs) and transitions rag to SORTED.
   */
  @Patch(':id/seal')
  @RequirePermissions('SORTING_STAGE1_CLOSE')
  @HttpCode(HttpStatus.OK)
  async seal(
    @Param('id') sessionId: string,
    @Body() dto: Stage1SealDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.sortSessionService.close(tenantId, sessionId, user.userId, { wasteCategoryId: dto?.wasteCategoryId });
    return this.getSessionSummary(tenantId, sessionId);
  }

  /**
   * Stage-1 Waste: add an explicit categorized waste line item.
   */
  @Post('waste')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async addWaste(@Body() dto: Stage1AddWasteDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const session = await this.prisma.sortSession.findFirst({
      where: { id: dto.sessionId, tenantId },
      include: {
        rag: { select: { id: true, containerId: true } },
        incomingBale: { select: { containerId: true } },
      },
    });
    if (!session) throw new BadRequestException('Sort session not found');
    if (session.status !== SortStatus.OPEN) throw new BadRequestException('Cannot add waste after sealing');

    const totalOutputWeight = session.totalOutputWeight ?? new Decimal(0);
    const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);
    if (computedWasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('Invalid session totals (output exceeds input)');
    }

    const existingWasteAgg = await prismaAny.wasteLineItem.aggregate({
      where: { tenantId, stage: 'STAGE_1', sortSessionId: session.id },
      _sum: { amount: true },
    });
    const existingWasteAmount = existingWasteAgg._sum.amount ?? new Decimal(0);
    const nextWasteAmount = existingWasteAmount.add(new Decimal(dto.amount ?? 0));
    if (nextWasteAmount.greaterThan(computedWasteWeight)) {
      throw new BadRequestException('Waste amount exceeds available remaining amount');
    }

    const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
    const ragId = session.ragId ?? session.rag?.id ?? null;

    await this.wasteService.createLineItem(
      tenantId,
      {
        stage: 'STAGE_1' as any,
        wasteCategoryId: dto.wasteCategoryId,
        amount: dto.amount,
        sortSessionId: session.id,
      },
      {
        containerId,
        ragId,
        categoryOutputId: null,
      },
    );

    return this.getSessionSummary(tenantId, session.id);
  }

  /**
   * Stage-1 Waste: edit an existing waste line item.
   */
  @Patch('waste/:id')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async updateWaste(
    @Param('id') wasteLineItemId: string,
    @Body() dto: Stage1UpdateWasteDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const existing = await prismaAny.wasteLineItem.findFirst({
      where: { id: wasteLineItemId, tenantId, stage: 'STAGE_1' },
      include: { sortSession: { select: { id: true, status: true, totalInputWeight: true, totalOutputWeight: true } } },
    });
    if (!existing || !existing.sortSession) throw new BadRequestException('Waste line item not found');
    if (existing.sortSession.status !== SortStatus.OPEN) throw new BadRequestException('Cannot edit waste after sealing');

    const totalOutputWeight = existing.sortSession.totalOutputWeight ?? new Decimal(0);
    const computedWasteWeight = existing.sortSession.totalInputWeight.sub(totalOutputWeight);
    if (computedWasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('Invalid session totals (output exceeds input)');
    }

    const otherWasteAgg = await prismaAny.wasteLineItem.aggregate({
      where: {
        tenantId,
        stage: 'STAGE_1',
        sortSessionId: existing.sortSession.id,
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
    return this.getSessionSummary(tenantId, existing.sortSession.id);
  }

  /**
   * Stage-1 Waste: remove a waste line item.
   */
  @Delete('waste/:id')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async removeWaste(
    @Param('id') wasteLineItemId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const prismaAny = this.prisma as any;

    const existing = await prismaAny.wasteLineItem.findFirst({
      where: { id: wasteLineItemId, tenantId, stage: 'STAGE_1' },
      select: { id: true, sortSessionId: true },
    });
    if (!existing || !existing.sortSessionId) throw new BadRequestException('Waste line item not found');

    const session = await this.prisma.sortSession.findFirst({
      where: { id: existing.sortSessionId, tenantId },
      select: { id: true, status: true },
    });
    if (!session) throw new BadRequestException('Sort session not found');
    if (session.status !== SortStatus.OPEN) throw new BadRequestException('Cannot remove waste after sealing');

    await this.wasteService.deleteLineItem(tenantId, existing.id);
    return this.getSessionSummary(tenantId, session.id);
  }

  private async getSessionSummary(tenantId: string, sessionId: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, status: true, totalInputWeight: true, totalOutputWeight: true, wasteWeight: true },
    });
    const buckets = await this.prisma.sortCategoryBucket.findMany({
      where: { sortSessionId: sessionId },
      orderBy: { updatedAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    });

    const prismaAny = this.prisma as any;
    const wasteLineItems = await prismaAny.wasteLineItem.findMany({
      where: { tenantId, stage: 'STAGE_1', sortSessionId: sessionId },
      orderBy: { updatedAt: 'desc' },
      include: { wasteCategory: true },
    });

    if (!session) return { session: null, buckets, wasteLineItems: [] };

    const totalOutputWeight = session.totalOutputWeight ?? new Decimal(0);
    const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);
    const declaredWasteAmount = wasteLineItems.reduce((sum, li) => sum.add(li.amount), new Decimal(0));
    const remainingWasteAmount = computedWasteWeight.sub(declaredWasteAmount);

    return {
      session: {
        ...session,
        computedWasteWeight: computedWasteWeight.toString(),
        declaredWasteAmount: declaredWasteAmount.toString(),
        remainingWasteAmount: remainingWasteAmount.toString(),
      },
      buckets,
      wasteLineItems,
    };
  }
}
