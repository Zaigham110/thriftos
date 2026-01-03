import { Module } from '@nestjs/common';
import { RepackUnitController } from './repack-unit.controller';
import { RepackUnitService } from './repack-unit.service';
import { RepackAllocationService } from '../shared/repack-allocation.service';
import { RepackV3Service } from '../v3/repack-v3.service';

@Module({
  controllers: [RepackUnitController],
  providers: [RepackUnitService, RepackAllocationService, RepackV3Service],
  exports: [RepackUnitService],
})
export class RepackUnitModule {}


