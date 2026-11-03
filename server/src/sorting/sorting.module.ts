import { Module } from '@nestjs/common';
import { GradeSessionService } from './grade-session.service';
import { GradesService } from './grades.service';
import { SortSessionService } from './sort-session.service';
import { SortingOutputsController, SortingStage1Controller, SortingStage2Controller } from './sorting.controller';
import { SortingOutputsService } from './sorting-outputs.service';
import { SortingWasteService } from './sorting-waste.service';

/** Stage 1 (lot → categories) and stage 2 (category → grades) sorting, plus grade master data. */
@Module({
  controllers: [SortingStage1Controller, SortingStage2Controller, SortingOutputsController],
  providers: [SortSessionService, GradeSessionService, SortingWasteService, SortingOutputsService, GradesService],
  exports: [GradesService, SortingOutputsService],
})
export class SortingModule {}
