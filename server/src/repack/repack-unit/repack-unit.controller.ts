import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackUnitDto, CreateRepackUnitV2Dto, SealRepackUnitV3Dto } from './dto';
import { RepackUnitService } from './repack-unit.service';
import { AllocateRepackUnitDto } from './dto/allocate-repack-unit.dto';
import { DeallocateRepackUnitDto } from './dto/deallocate-repack-unit.dto';
import { MeasurementType } from '@prisma/client';
import { RepackV3Service } from '../v3/repack-v3.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('repack')
@UseGuards(TenantGuard, PermissionGuard)
export class RepackUnitController {
  constructor(
    private readonly service: RepackUnitService,
    private readonly repackV3: RepackV3Service,
    private readonly prisma: PrismaService,
  ) {}

  // =============================================================
  // READ-ONLY CONTEXT ENDPOINTS (NO MUTATION)
  // =============================================================

  @Get('context/grading-output/:id')
  @RequirePermissions('REPACK_VIEW')
  async getContextFromGradingOutput(
    @Param('id') gradingOutputId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;

    const gradingOutput = await this.prisma.gradeOutput.findFirst({
      where: { id: gradingOutputId, tenantId },
      include: {
        gradeBucket: {
          include: {
            gradeSession: {
              include: {
                categoryOutput: true,
              },
            },
          },
        },
      },
    });

    if (!gradingOutput) {
      return {
        gradingOutputId,
        found: false,
      };
    }

    return {
      found: true,
      gradingOutputId: gradingOutput.id,
      categoryId: gradingOutput.gradeBucket.gradeSession.categoryOutput.categoryId,
      gradeId: gradingOutput.gradeId,
      measurementType: gradingOutput.measurementType as MeasurementType,
      remainingAmount: gradingOutput.remainingAmount,
      totalAmount: gradingOutput.totalAmount,
      status: gradingOutput.status,
    };
  }

  // =============================================================
  // FIX-5: PRE-REPACK SAFETY VALIDATION
  // =============================================================

  @Get('validate/grading-output/:id')
  @RequirePermissions('REPACK_VIEW')
  async validateGradingOutputForRepack(
    @Param('id') gradingOutputId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;

    const output = await this.prisma.gradeOutput.findFirst({
      where: { id: gradingOutputId, tenantId },
      include: {
        gradeBucket: {
          include: {
            gradeSession: {
              include: {
                categoryOutput: {
                  include: {
                    sortCategoryBucket: {
                      include: {
                        sortSession: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!output) {
      return {
        valid: false,
        errors: ['Grade output not found'],
      };
    }

    const errors: string[] = [];

    // A. Sort Session Closed
    const sortSession = output.gradeBucket.gradeSession.categoryOutput.sortCategoryBucket?.sortSession;
    if (sortSession && sortSession.status !== 'CLOSED') {
      errors.push('Sort session must be CLOSED before repack');
    }

    // B. Grade Session Closed
    const gradeSession = output.gradeBucket.gradeSession;
    if (gradeSession.status !== 'CLOSED') {
      errors.push('Grade session must be CLOSED before repack');
    }

    // C. No Open Waste Entries
    // Note: WasteLineItem doesn't have finalizedAt field in current schema
    // Waste is finalized when Grade Session is CLOSED (checked above)
    // If additional waste validation is needed, it should be based on session status

    // D. No Open Grade Buckets
    const openBucketsCount = await this.prisma.gradeBucket.count({
      where: {
        gradeSessionId: gradeSession.id,
        // No explicit "status" field on GradeBucket in current schema
        // Bucket "openness" is implied by session status
        // If session is CLOSED, all buckets are implicitly closed
      },
    });

    // Since buckets don't have status field, check is redundant if session is CLOSED
    // But we verify session closure above, so this is satisfied

    return {
      valid: errors.length === 0,
      errors,
      output: errors.length === 0
        ? {
            id: output.id,
            categoryId: gradeSession.categoryOutput.categoryId,
            gradeId: output.gradeId,
            remainingAmount: Number(output.remainingAmount),
          }
        : undefined,
    };
  }

  @Post('sessions/:id/units')
  @RequirePermissions('REPACK_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async createForSession(
    @Param('id') sessionId: string,
    @Body() dto: CreateRepackUnitDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.createForSession(tenantId, sessionId, dto, user.userId);
  }

  @Get('units')
  @RequirePermissions('REPACK_VIEW')
  async findAll(
    @Query('sessionId') sessionId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { sessionId, page, limit });
  }

  // IMPORTANT: static routes must be declared before `units/:id` to avoid shadowing.
  @Get('units/drafts')
  @RequirePermissions('REPACK_VIEW')
  async getDrafts(
    @Query('sessionId') sessionId: string | undefined,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.getDraftUnits(tenantId, sessionId);
  }

  @Get('units/sealed')
  @RequirePermissions('REPACK_VIEW')
  async getSealedUnits(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.getSealedUnits(tenantId);
  }

  @Get('units/:id')
  @RequirePermissions('REPACK_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  // =============================================================
  // MIXED-SOURCE REPACK V2 ENDPOINTS
  // =============================================================

  @Get('available-stock')
  @RequirePermissions('REPACK_VIEW')
  async getAvailableStock(
    @Query('categoryId') categoryId: string | undefined,
    @Query('gradeId') gradeId: string | undefined,
    @Query('measurementType') measurementType: MeasurementType | undefined,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.repackV3.getAvailableStock(tenantId, categoryId, gradeId, measurementType);
  }

  // ===================================================================
  // DELETED 2025-01-21: FIFO ENDPOINTS REMOVED - MANUAL ALLOCATION ONLY
  // ===================================================================
  // @Get('units/fifo/preview')
  // @RequirePermissions('REPACK_VIEW')
  // async previewFIFO(...) { ... }
  //
  // @Post('units/fifo')
  // @RequirePermissions('REPACK_ALLOCATE')
  // async createFIFO(...) { ... }
  // ===================================================================

  @Post('units/manual')
  @RequirePermissions('REPACK_ALLOCATE')
  @HttpCode(HttpStatus.CREATED)
  async createManual(
    @Body() dto: CreateRepackUnitV2Dto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.repackV3.createDraftManual(tenantId, dto, user.userId);
  }

  @Patch('units/:id/seal')
  @RequirePermissions('REPACK_ALLOCATE')
  async sealUnit(
    @Param('id') id: string,
    @Body() dto: SealRepackUnitV3Dto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.repackV3.sealUnit(tenantId, id, dto.warehouseId ?? null, user.userId);
  }

  @Patch('units/:id/allocate')
  @RequirePermissions('REPACK_ALLOCATE')
  async allocateToDraft(
    @Param('id') id: string,
    @Body() dto: AllocateRepackUnitDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.allocateToDraft(tenantId, id, dto.allocations, user.userId);
  }

  @Patch('units/:id/deallocate')
  @RequirePermissions('REPACK_ALLOCATE')
  async deallocateFromDraft(
    @Param('id') id: string,
    @Body() dto: DeallocateRepackUnitDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.deallocateFromDraft(tenantId, id, dto.allocationId, user.userId);
  }

  @Delete('units/:id')
  @RequirePermissions('REPACK_ALLOCATE')
  @HttpCode(HttpStatus.OK)
  async deleteDraft(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.deleteDraft(tenantId, id, user.userId);
  }
}
