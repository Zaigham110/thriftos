import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ClientErrorsController } from './client-errors.controller';
import { ServerErrorsFilter } from './server-errors.filter';

@Module({
  controllers: [ClientErrorsController],
  providers: [{ provide: APP_FILTER, useClass: ServerErrorsFilter }],
})
export class MonitoringModule {}
