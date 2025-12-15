import { Module } from '@nestjs/common';
import { GradeSessionController } from './grade-session.controller';
import { GradeSessionService } from './grade-session.service';

@Module({
  controllers: [GradeSessionController],
  providers: [GradeSessionService],
  exports: [GradeSessionService],
})
export class GradeSessionModule {}


