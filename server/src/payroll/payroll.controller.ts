import { Idempotent } from '../common/idempotency/idempotent.interceptor';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WorkerPayType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PayrollService } from './payroll.service';

export class WorkerDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsEnum(WorkerPayType) payType!: WorkerPayType;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) rate!: number;
}
export class UpdateWorkerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsEnum(WorkerPayType) payType?: WorkerPayType;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) rate?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class AdvanceDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsDateString() day?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
export class PeriodDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}
export class LineDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(31) days?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deductions?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
export class RangeQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}

/** Phase 8 sorter pay (owners): workers, advances, pay sheets, productivity. */
@Controller('payroll')
@UseGuards(TenantGuard, PermissionGuard)
@RequireModule('PAYROLL')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('workers')
  @RequirePermissions('tenant.update')
  workers(@TenantId() tenantId: string, @Query('all') all?: string) {
    return this.payroll.workers(tenantId, all === '1' || all === 'true');
  }

  @Post('workers')
  @RequirePermissions('tenant.update')
  addWorker(@TenantId() tenantId: string, @Body() dto: WorkerDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.addWorker(tenantId, dto, user.userId);
  }

  @Get('workers/:id')
  @RequirePermissions('tenant.update')
  worker(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.worker(tenantId, id);
  }

  @Patch('workers/:id')
  @RequirePermissions('tenant.update')
  updateWorker(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWorkerDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.updateWorker(tenantId, id, dto, user.userId);
  }

  @Idempotent('WORKER_ADVANCE')
  @Post('workers/:id/advances')
  @RequirePermissions('tenant.update')
  advance(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: AdvanceDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.giveAdvance(tenantId, id, dto, user.userId);
  }

  @Get('sheets')
  @RequirePermissions('tenant.update')
  sheets(@TenantId() tenantId: string) {
    return this.payroll.sheets(tenantId);
  }

  @Post('sheets')
  @RequirePermissions('tenant.update')
  createSheet(@TenantId() tenantId: string, @Body() dto: PeriodDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.createSheet(tenantId, dto, user.userId);
  }

  @Get('sheets/:id')
  @RequirePermissions('tenant.update')
  sheet(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.sheet(tenantId, id);
  }

  @Patch('lines/:id')
  @RequirePermissions('tenant.update')
  updateLine(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: LineDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.updateLine(tenantId, id, dto, user.userId);
  }

  @Post('sheets/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('tenant.update')
  pay(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payroll.paySheet(tenantId, id, user.userId);
  }

  @Delete('sheets/:id')
  @RequirePermissions('tenant.update')
  deleteSheet(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payroll.deleteSheet(tenantId, id, user.userId);
  }

  @Get('productivity')
  @RequirePermissions('tenant.update')
  productivity(@TenantId() tenantId: string, @Query() q: RangeQuery) {
    return this.payroll.productivity(tenantId, q.from, q.to);
  }
}

/** The sorting screen's worker chips: active workers (none when Payroll is off). */
@Controller('sorting')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingWorkersController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('workers')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  workers(@TenantId() tenantId: string) {
    return this.payroll.forSorting(tenantId);
  }
}
