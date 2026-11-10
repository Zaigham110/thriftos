import { catalogue, isModuleKey } from '../common/modules/modules';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantService } from './tenant.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions, SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';
import { Idempotent } from '../common/idempotency/idempotent.interceptor';
import { TenantSetupDto } from './dto/setup.dto';
import { SetupService } from './setup.service';
import { DataExportService } from './data-export.service';
import { BusinessDto, BusinessService } from './business.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';

/**
 * TenantController - the current tenant, its settings, and lookup lists for pickers
 * (categories, raw categories, grades, warehouses). Lookups are open to every tenant user;
 * writes need permissions. Managing categories and warehouses lives under /admin.
 */
@Controller('tenant')
@UseGuards(TenantGuard, PermissionGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly setup: SetupService,
    private readonly dataExport: DataExportService,
    private readonly business: BusinessService,
  ) {}

  /** Everything that belongs to this business as a zip of CSV files (owner only: data.export). */
  @Get('export')
  @RequirePermissions('data.export')
  async export(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Res() res: Response) {
    const { filename, zip } = await this.dataExport.exportZip(tenantId, user.userId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(zip));
  }

  /** Every module ThriftOS has (names in three languages) and which ones this business has on (v2 modules). */
  @Get('modules')
  @SkipPermissionCheck()
  async modules(@TenantId() tenantId: string) {
    const t = await this.tenantService.modulesOf(tenantId);
    return { ...catalogue(), on: t.filter(isModuleKey) };
  }

  @Get()
  @SkipPermissionCheck()
  async getCurrentTenant(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.findOne(tenantId);
  }

  /** Setup wizard (journey 8): where it starts from (Karachi template until done). */
  /** Settings → Business: name, phone, address, city, currency, language and how the business works. */
  @Get('business')
  @RequirePermissions('tenant.update')
  getBusiness(@TenantId() tenantId: string) {
    return this.business.get(tenantId);
  }

  @Patch('business')
  @RequirePermissions('tenant.update')
  saveBusiness(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: BusinessDto) {
    return this.business.save(tenantId, dto, user.userId);
  }

  @Get('setup')
  @RequirePermissions('tenant.update')
  setupDefaults(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.setup.defaults((req as any).tenantId || user.tenantId);
  }

  /** Setup wizard: saves everything in one step. Safe to repeat with an Idempotency-Key. */
  @Post('setup')
  @Idempotent('TENANT_SETUP')
  @RequirePermissions('tenant.update')
  @HttpCode(HttpStatus.OK)
  saveSetup(@Body() dto: TenantSetupDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.setup.save((req as any).tenantId || user.tenantId, dto, user.userId);
  }

  @Get('work-queue')
  @SkipPermissionCheck()
  async getWorkQueue(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWorkQueue(tenantId, user.userId);
  }

  @Patch('settings')
  @RequirePermissions('tenant.update')
  async updateTenantSettings(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateSettings(tenantId, dto, user.userId);
  }

  @Get('categories')
  @SkipPermissionCheck()
  async getCategories(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getCategories(tenantId);
  }





  @Get('raw-categories')
  @SkipPermissionCheck()
  async getRawCategories(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Query('type') type?: RagBaleType,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getRawCategories(tenantId, type);
  }

  @Post('raw-categories')
  @RequirePermissions('category.create')
  async createRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: CreateRawCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createRawCategory(tenantId, dto);
  }

  @Put('raw-categories/:id')
  @RequirePermissions('category.update')
  async updateRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRawCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateRawCategory(tenantId, id, dto);
  }

  @Delete('raw-categories/:id')
  @RequirePermissions('category.delete')
  async deleteRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteRawCategory(tenantId, id);
  }

  @Get('grades')
  @SkipPermissionCheck()
  async getGrades(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getGrades(tenantId);
  }

  @Get('warehouses')
  @SkipPermissionCheck()
  async getWarehouses(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWarehouses(tenantId);
  }





  @Get('stats')
  @SkipPermissionCheck()
  async getStats(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getStats(tenantId);
  }
}
