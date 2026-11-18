import { Idempotent } from '../common/idempotency/idempotent.interceptor';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AttendanceStatus, LeaveStatus, WorkerPayType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, Matches, ValidateNested } from 'class-validator';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators/permissions.decorator';
import { Can } from '../common/decorators/can.decorator';
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
  @IsOptional() @IsString() @MaxLength(80) jobTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(20) cnic?: string | null;
  @IsOptional() @IsDateString() joinedOn?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) emergencyContact?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(366) leaveAllowance?: number;
}
export class LoanDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  /** Taken off each pay sheet until the loan is repaid. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) instalment!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
export class LoanRepayDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
}
export class EmployeeSettingsDto {
  @IsOptional() @IsBoolean() trackSorterWork?: boolean;
  /** Unused paid leave carried into the next year, at most this many days (0 = none). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(366) leaveCarryMax?: number;
}
export class LeaveDto {
  @IsString() workerId!: string;
  @IsDateString() fromDay!: string;
  @IsDateString() toDay!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
  /** Give it at once instead of leaving it waiting. */
  @IsOptional() @IsBoolean() approve?: boolean;
}
export class LeaveQuery {
  @IsOptional() @IsEnum(LeaveStatus) status?: LeaveStatus;
}
export class UpdateWorkerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsEnum(WorkerPayType) payType?: WorkerPayType;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) rate?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(80) jobTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(20) cnic?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null && v !== '') @IsDateString() joinedOn?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null && v !== '') @IsDateString() leftOn?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) emergencyContact?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(366) leaveAllowance?: number;
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
  /** Whole or half days. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(31) days?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deductions?: number;
  /** Added on top of the pay (bonus, allowance, overtime) and what it is for. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) bonus?: number;
  @IsOptional() @IsString() @MaxLength(80) bonusNote?: string;
  /** Towards the employee's loans, from this pay. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) loan?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
export class AttendanceMarkDto {
  @IsString() workerId!: string;
  /** null clears the mark. */
  @ValidateIf((_o, v) => v !== null) @IsEnum(AttendanceStatus) status!: AttendanceStatus | null;
  @IsOptional() @IsString() @MaxLength(120) note?: string | null;
}
export class AttendanceDto {
  @IsDateString() day!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => AttendanceMarkDto) marks!: AttendanceMarkDto[];
}
export class DayQuery {
  @IsDateString() day!: string;
}
export class MonthQuery {
  @Matches(/^\d{4}-\d{2}$/) month!: string;
}
export class RangeQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}

/**
 * Employees (owner, 2026-11-17/18): records, attendance and leave need "employee.manage" (the Manager has it); pay
 * sheets, advances, loans and the settings need "payroll.run" (the owner's unless given).
 */
@Controller('payroll')
@UseGuards(TenantGuard, PermissionGuard)
@RequireModule('PAYROLL')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  /** Employees (owner, 2026-11-17): whether sorting counts what each sorter sorts. */
  @Get('settings')
  @RequireAnyPermission('employee.manage', 'payroll.run')
  settings(@TenantId() tenantId: string) {
    return this.payroll.settings(tenantId);
  }

  @Patch('settings')
  @RequirePermissions('payroll.run')
  setSettings(@TenantId() tenantId: string, @Body() dto: EmployeeSettingsDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.setSettings(tenantId, dto, user.userId);
  }

  @Get('workers')
  @RequireAnyPermission('employee.manage', 'payroll.run')
  async workers(@TenantId() tenantId: string, @Can('payroll.run') canPay: boolean, @Query('all') all?: string) {
    const rows = await this.payroll.workers(tenantId, all === '1' || all === 'true');
    // What someone owes on a loan is for the people who pay.
    return canPay ? rows : rows.map((r) => ({ ...r, loanLeft: null }));
  }

  @Post('workers')
  @RequirePermissions('employee.manage')
  addWorker(@TenantId() tenantId: string, @Body() dto: WorkerDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.addWorker(tenantId, dto, user.userId);
  }

  @Get('workers/:id')
  @RequireAnyPermission('employee.manage', 'payroll.run')
  worker(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.worker(tenantId, id);
  }

  @Patch('workers/:id')
  @RequirePermissions('employee.manage')
  updateWorker(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateWorkerDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.updateWorker(tenantId, id, dto, user.userId);
  }

  @Idempotent('WORKER_ADVANCE')
  @Post('workers/:id/advances')
  @RequirePermissions('payroll.run')
  advance(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: AdvanceDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.giveAdvance(tenantId, id, dto, user.userId);
  }

  /** Loans (owner, 2026-11-17): lend, see what is left, take cash back. Instalments come off pay sheets. */
  @Get('workers/:id/loans')
  @RequirePermissions('payroll.run')
  loans(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.loans(tenantId, id);
  }

  @Idempotent('EMPLOYEE_LOAN')
  @Post('workers/:id/loans')
  @RequirePermissions('payroll.run')
  giveLoan(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: LoanDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.giveLoan(tenantId, id, dto, user.userId);
  }

  @Idempotent('EMPLOYEE_LOAN_REPAY')
  @Post('workers/:id/loans/repay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll.run')
  repayLoan(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: LoanRepayDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.repayLoan(tenantId, id, dto, user.userId);
  }

  @Get('sheets')
  @RequirePermissions('payroll.run')
  sheets(@TenantId() tenantId: string) {
    return this.payroll.sheets(tenantId);
  }

  @Post('sheets')
  @RequirePermissions('payroll.run')
  createSheet(@TenantId() tenantId: string, @Body() dto: PeriodDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.createSheet(tenantId, dto, user.userId);
  }

  @Get('sheets/:id')
  @RequirePermissions('payroll.run')
  sheet(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.payroll.sheet(tenantId, id);
  }

  @Patch('lines/:id')
  @RequirePermissions('payroll.run')
  updateLine(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: LineDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.updateLine(tenantId, id, dto, user.userId);
  }

  @Post('sheets/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll.run')
  pay(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payroll.paySheet(tenantId, id, user.userId);
  }

  @Delete('sheets/:id')
  @RequirePermissions('payroll.run')
  deleteSheet(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payroll.deleteSheet(tenantId, id, user.userId);
  }

  /** Attendance (owner, 2026-11-17): one day's marks, marking, and a month at a glance. */
  @Get('attendance')
  @RequirePermissions('employee.manage')
  attendanceDay(@TenantId() tenantId: string, @Query() q: DayQuery) {
    return this.payroll.attendanceDay(tenantId, q.day);
  }

  @Put('attendance')
  @RequirePermissions('employee.manage')
  markAttendance(@TenantId() tenantId: string, @Body() dto: AttendanceDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.markAttendance(tenantId, dto, user.userId);
  }

  /** Leave (owner, 2026-11-18): asked for over days, then given or refused; given leave marks Attendance. */
  @Get('leave')
  @RequirePermissions('employee.manage')
  leave(@TenantId() tenantId: string, @Query() q: LeaveQuery) {
    return this.payroll.leaveRequests(tenantId, q.status);
  }

  @Idempotent('LEAVE_ASK')
  @Post('leave')
  @RequirePermissions('employee.manage')
  askLeave(@TenantId() tenantId: string, @Body() dto: LeaveDto, @CurrentUser() user: CurrentUserData) {
    return this.payroll.askLeave(tenantId, dto, user.userId);
  }

  @Post('leave/:id/:decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('employee.manage')
  decideLeave(@TenantId() tenantId: string, @Param('id') id: string, @Param('decision') decision: string, @CurrentUser() user: CurrentUserData) {
    if (decision !== 'approve' && decision !== 'reject' && decision !== 'cancel') throw new NotFoundException();
    return this.payroll.decideLeave(tenantId, id, decision, user.userId);
  }

  @Get('attendance/month')
  @RequirePermissions('employee.manage')
  attendanceMonth(@TenantId() tenantId: string, @Query() q: MonthQuery) {
    return this.payroll.attendanceMonth(tenantId, q.month);
  }

  @Get('productivity')
  @RequireAnyPermission('employee.manage', 'payroll.run')
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
