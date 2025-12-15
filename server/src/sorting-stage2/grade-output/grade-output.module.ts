import { Module } from '@nestjs/common';
import { GradeOutputController } from './grade-output.controller';
import { GradeOutputService } from './grade-output.service';

@Module({
  controllers: [GradeOutputController],
  providers: [GradeOutputService],
  exports: [GradeOutputService],
})
export class GradeOutputModule {}


