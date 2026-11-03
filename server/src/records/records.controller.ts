import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ATTACHMENT_MAX_BYTES } from './record-types';
import { RecordsService, UploadedFileLike } from './records.service';

export class NoteDto {
  @IsString() @MaxLength(2000) text!: string;
  /** User ids picked with @ in the note box. */
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @IsOptional() mentions?: string[];
}

@Controller()
@UseGuards(TenantGuard, PermissionGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get('records/mentionable')
  @SkipPermissionCheck()
  mentionable(@TenantId() tenantId: string, @Query('q') q?: string) {
    return this.records.mentionable(tenantId, q);
  }

  @Get('records/attachments/:attachmentId')
  @SkipPermissionCheck()
  async download(@TenantId() tenantId: string, @Param('attachmentId') attachmentId: string) {
    const f = await this.records.download(tenantId, attachmentId);
    return new StreamableFile(f.data, { type: f.type, disposition: `attachment; filename="${encodeURIComponent(f.fileName)}"` });
  }

  @Get('records/:type/:id/activity')
  @SkipPermissionCheck()
  activity(@TenantId() tenantId: string, @Param('type') type: string, @Param('id') id: string) {
    return this.records.activity(tenantId, type, id);
  }

  @Post('records/:type/:id/notes')
  @SkipPermissionCheck()
  note(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('type') type: string, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.records.addNote(tenantId, type, id, user.userId, dto.text, dto.mentions);
  }

  @Post('records/:type/:id/attachments')
  @SkipPermissionCheck()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ATTACHMENT_MAX_BYTES + 1 } }))
  attach(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('type') type: string, @Param('id') id: string, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.records.attach(tenantId, type, id, user.userId, file);
  }

  @Get('notifications')
  @SkipPermissionCheck()
  notifications(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query('unread') unread?: string) {
    return this.records.notifications(tenantId, user.userId, unread === '1');
  }

  @Post('notifications/:id/read')
  @SkipPermissionCheck()
  @HttpCode(HttpStatus.NO_CONTENT)
  read(@TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.records.markRead(tenantId, user.userId, id === 'all' ? 'all' : id);
  }
}
