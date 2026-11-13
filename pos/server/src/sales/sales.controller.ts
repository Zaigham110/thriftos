import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Actor, ManagerUp, Me } from '../common/auth.guard';
import { optText } from '../common/util';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@Me() me: Actor, @Query() q: Record<string, string>) {
    return this.sales.list(me, q);
  }

  @Post()
  create(@Me() me: Actor, @Body() body: Record<string, unknown>) {
    return this.sales.create(me, body);
  }

  @Get(':id')
  get(@Me() me: Actor, @Param('id') id: string) {
    return this.sales.get(me, id);
  }

  @ManagerUp()
  @Post(':id/cancel')
  cancel(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.sales.cancel(me, id, optText(body.reason, 'Reason'));
  }

  @ManagerUp()
  @Post(':id/returns')
  refund(@Me() me: Actor, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.sales.refund(me, id, body);
  }

  @ManagerUp()
  @Post(':id/reviewed')
  reviewed(@Me() me: Actor, @Param('id') id: string) {
    return this.sales.reviewed(me, id);
  }
}
