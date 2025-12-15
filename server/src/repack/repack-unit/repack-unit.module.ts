import { Module } from '@nestjs/common';
import { RepackUnitController } from './repack-unit.controller';
import { RepackUnitService } from './repack-unit.service';

@Module({
  controllers: [RepackUnitController],
  providers: [RepackUnitService],
  exports: [RepackUnitService],
})
export class RepackUnitModule {}


