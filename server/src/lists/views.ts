import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LISTS } from './list-registry';

const MAX_STATE_BYTES = 8 * 1024;

export class CreateViewDto {
  @IsString() resource!: string;
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  /** What the screen needs to restore the view: filters, sort, columns, group-by, density. */
  @IsObject() state!: Record<string, unknown>;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}

export class UpdateViewDto {
  @IsString() @MinLength(1) @MaxLength(60) @IsOptional() name?: string;
  @IsObject() @IsOptional() state?: Record<string, unknown>;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}

/** Saved list views (enterprise plan E2.2): per person, per list; one default per list. */
@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  private check(resource?: string, state?: Record<string, unknown>) {
    if (resource !== undefined && !LISTS[resource]) throw new BadRequestException(`No list "${resource}"`);
    if (state !== undefined && Buffer.byteLength(JSON.stringify(state)) > MAX_STATE_BYTES) throw new BadRequestException('View is too large');
  }

  list(tenantId: string, userId: string, resource: string) {
    this.check(resource);
    return this.prisma.savedView.findMany({ where: { tenantId, userId, resource }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  async create(tenantId: string, userId: string, dto: CreateViewDto) {
    this.check(dto.resource, dto.state);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) await tx.savedView.updateMany({ where: { userId, resource: dto.resource }, data: { isDefault: false } });
        return tx.savedView.create({ data: { tenantId, userId, resource: dto.resource, name: dto.name.trim(), state: dto.state as Prisma.InputJsonValue, isDefault: !!dto.isDefault } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('You already have a view with this name');
      throw e;
    }
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateViewDto) {
    this.check(undefined, dto.state);
    const view = await this.prisma.savedView.findFirst({ where: { id, tenantId, userId } });
    if (!view) throw new NotFoundException('View not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) await tx.savedView.updateMany({ where: { userId, resource: view.resource, id: { not: id } }, data: { isDefault: false } });
        return tx.savedView.update({
          where: { id },
          data: { name: dto.name?.trim(), state: dto.state as Prisma.InputJsonValue | undefined, isDefault: dto.isDefault },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('You already have a view with this name');
      throw e;
    }
  }

  async remove(tenantId: string, userId: string, id: string) {
    const gone = await this.prisma.savedView.deleteMany({ where: { id, tenantId, userId } });
    if (!gone.count) throw new NotFoundException('View not found');
  }
}

@Controller('views')
@UseGuards(TenantGuard, PermissionGuard)
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  @SkipPermissionCheck()
  list(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query('resource') resource: string) {
    return this.views.list(tenantId, user.userId, resource);
  }

  @Post()
  @SkipPermissionCheck()
  create(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Body() dto: CreateViewDto) {
    return this.views.create(tenantId, user.userId, dto);
  }

  @Patch(':id')
  @SkipPermissionCheck()
  update(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateViewDto) {
    return this.views.update(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @SkipPermissionCheck()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.views.remove(tenantId, user.userId, id);
  }
}
