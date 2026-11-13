import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Actor, Me, OwnerOnly } from '../common/auth.guard';
import { BALE_COLUMNS, baleTemplate } from './bale-file';
import { ShipmentsService, Upload } from './shipments.service';

const FILE = FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } });

/** Shipments carry costs, so they are the owner's. */
@OwnerOnly()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  list(@Me() me: Actor) {
    return this.shipments.list(me.tenantId);
  }

  @Get('columns')
  columns() {
    return BALE_COLUMNS.map(({ key, label, required, example, help }) => ({ key, label, required: !!required, example, help }));
  }

  @Get('template')
  async template(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bale-list-sample.xlsx"');
    res.send(await baleTemplate());
  }

  @Get('suppliers')
  suppliers(@Me() me: Actor) {
    return this.shipments.suppliers(me.tenantId);
  }

  /** Reads the file and shows what would be saved; saves nothing. */
  @Post('preview')
  @UseInterceptors(FILE)
  preview(@Body() body: Record<string, unknown>, @UploadedFile() file: Upload | undefined) {
    return this.shipments.preview(body, file);
  }

  @Post()
  @UseInterceptors(FILE)
  create(@Me() me: Actor, @Body() body: Record<string, unknown>, @UploadedFile() file: Upload | undefined) {
    return this.shipments.create(me, body, file);
  }

  @Get(':id')
  get(@Me() me: Actor, @Param('id') id: string) {
    return this.shipments.get(me.tenantId, id);
  }
}
