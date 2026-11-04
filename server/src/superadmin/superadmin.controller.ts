import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantStatus } from '@prisma/client';
import { SuperAdminService } from './superadmin.service';
import { AuthService } from '../auth/auth.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from './dto/tenant-response.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { SuperAdminOnly } from '../common/decorators/super-admin.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { BootstrapResult } from './tenant-bootstrap.service';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { SYSTEM_COMPANY_CODE } from '../common/guards/module.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingService } from './onboarding.service';
import { QuickCreateTenantDto, SupportViewDto } from './dto/quick-create.dto';

@Controller('superadmin')
@UseGuards(TenantGuard)
@SuperAdminOnly()
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  /** Modules turned on for the platform itself (the SYSTEM business): what the super admin console shows. */
  @Get('modules')
  async getModules() {
    const system = await this.prisma.tenant.findUnique({ where: { companyCode: SYSTEM_COMPANY_CODE }, select: { enabledModules: true } });
    return { enabledModules: system?.enabledModules ?? [] };
  }

  @Get('summary')
  async getSummary() {
    return this.superAdminService.getPlatformSummary();
  }

  @Get('users')
  async getGlobalUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.getGlobalUsers(page || 1, limit || 20, search);
  }

  @Get('audit-logs')
  async getGlobalAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
  ) {
    return this.superAdminService.getGlobalAuditLogs(page || 1, limit || 20, action);
  }

  @Get('plans')
  @RequireModule('BILLING')
  async getPlans() {
    return this.superAdminService.getPlansCatalog();
  }

  @Get('billing')
  @RequireModule('BILLING')
  async getBilling() {
    return this.superAdminService.getBillingSummary();
  }

  @Get('settings')
  async getSettings() {
    return this.superAdminService.getSystemSettings();
  }

  @Patch('settings')
  async updateSettings(
    @Body() dto: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.superAdminService.updateSystemSettings(dto, user.userId);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto & { bootstrap: BootstrapResult }> {
    return this.superAdminService.createTenant(dto, user.userId);
  }

  /** v2 6.5: business name, owner name and phone → ready to sign in, with the welcome message to send. */
  @Post('tenants/quick')
  @HttpCode(HttpStatus.CREATED)
  quickCreate(@Body() dto: QuickCreateTenantDto, @CurrentUser() user: CurrentUserData) {
    return this.onboarding.quickCreate(dto, user.userId);
  }

  @Get('tenants')
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TenantStatus,
  ): Promise<TenantListResponseDto> {
    const list = await this.superAdminService.findAll(page || 1, limit || 20, status);
    const last = await this.onboarding.lastActivity(list.data.map((t: any) => t.id));
    return { ...list, data: list.data.map((t: any) => ({ ...t, lastActivity: last.get(t.id) ?? null })) };
  }

  @Get('tenants/:id')
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    const tenant = await this.superAdminService.findOne(id);
    const last = await this.onboarding.lastActivity([id]);
    return { ...tenant, lastActivity: last.get(id) ?? null } as TenantResponseDto;
  }

  @Patch('tenants/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.update(id, dto, user.userId);
  }

  @Post('tenants/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.deactivate(id, user.userId);
  }

  @Post('tenants/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.activate(id, user.userId);
  }

  @Post('tenants/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() body: SupportViewDto = {},
  ): Promise<{ accessToken: string; impersonationToken: string; tenantId: string; expiresIn: number; expiresAt: string; readOnly: true }> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.createImpersonationToken(user.userId, id, ipAddress, userAgent, body?.reason?.trim() || undefined);
    const expiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();
    return {
      accessToken: result.accessToken,
      impersonationToken: result.accessToken,
      tenantId: id,
      expiresIn: result.expiresIn,
      expiresAt,
      readOnly: true,
    };
  }
}
