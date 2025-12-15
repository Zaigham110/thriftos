import { Module } from '@nestjs/common';
import { RepackItemController } from './repack-item.controller';
import { RepackItemService } from './repack-item.service';

@Module({
  controllers: [RepackItemController],
  providers: [RepackItemService],
  exports: [RepackItemService],
})
export class RepackItemModule {}


