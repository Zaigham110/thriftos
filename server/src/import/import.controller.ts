import { RequireModule } from '../common/decorators/require-module.decorator';
import { BadRequestException, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { IMPORT_KINDS, ImportKind } from './import-parse';
import { IMPORT_MAX_BYTES, ImportService, UploadedSheet } from './import.service';

const FILE_NAMES: Record<ImportKind, string> = {
  CUSTOMERS: 'thriftos-customers.xlsx',
  SUPPLIERS: 'thriftos-suppliers.xlsx',
  STOCK: 'thriftos-opening-stock.xlsx',
};

function kindOf(param: string): ImportKind {
  const kind = param.toUpperCase() as ImportKind;
  if (!IMPORT_KINDS.includes(kind)) throw new BadRequestException('Import customers, suppliers or stock');
  return kind;
}

/** Bring an old register in from Excel/CSV (v2 6.1): template → preview → confirm. Owner only (data.import). */
@RequireModule('IMPORT')
@Controller('import')
@UseGuards(TenantGuard, PermissionGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Get(':kind/template')
  @RequirePermissions('data.import')
  async template(@Param('kind') kind: string, @Res() res: Response) {
    const k = kindOf(kind);
    const file = await this.imports.template(k);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${FILE_NAMES[k]}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(file);
  }

  @Post(':kind/preview')
  @RequirePermissions('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES + 1 } }))
  preview(@TenantId() tenantId: string, @Param('kind') kind: string, @UploadedFile() file: UploadedSheet | undefined) {
    return this.imports.preview(tenantId, kindOf(kind), file);
  }

  @Post(':kind/commit')
  @RequirePermissions('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES + 1 } }))
  commit(@TenantId() tenantId: string, @Param('kind') kind: string, @UploadedFile() file: UploadedSheet | undefined, @CurrentUser() user: CurrentUserData) {
    return this.imports.commit(tenantId, kindOf(kind), file, user.userId);
  }
}
