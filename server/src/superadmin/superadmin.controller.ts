import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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

@Controller('superadmin/tenants')
@UseGuards(TenantGuard)
@SuperAdminOnly()
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto & { bootstrap: BootstrapResult }> {
    try {
      const result = await this.superAdminService.createTenant(dto, user.userId);
      console.log('Tenant created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TenantStatus,
  ): Promise<TenantListResponseDto> {
    return this.superAdminService.findAll(page || 1, limit || 20, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.superAdminService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.update(id, dto, user.userId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.deactivate(id, user.userId);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TenantResponseDto> {
    return this.superAdminService.activate(id, user.userId);
  }

  @Post(':id/impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.createImpersonationToken(user.userId, id, ipAddress, userAgent);
  }
}

