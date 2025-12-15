import { Module } from '@nestjs/common';
import { SortSessionController } from './sort-session.controller';
import { SortSessionService } from './sort-session.service';

@Module({
  controllers: [SortSessionController],
  providers: [SortSessionService],
  exports: [SortSessionService],
})
export class SortSessionModule {}


