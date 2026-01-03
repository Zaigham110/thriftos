import { Module } from '@nestjs/common';

import { RagModule } from '../procurement/rag/rag.module';
import { IncomingBaleModule } from '../procurement/incoming-bale/incoming-bale.module';

import { SortSessionModule } from '../sorting-stage1/sort-session/sort-session.module';
import { SortCategoryBucketModule } from '../sorting-stage1/sort-category-bucket/sort-category-bucket.module';
import { CategoryOutputModule } from '../sorting-stage1/category-output/category-output.module';

import { GradeSessionModule } from '../sorting-stage2/grade-session/grade-session.module';
import { GradeBucketModule } from '../sorting-stage2/grade-bucket/grade-bucket.module';
import { GradeOutputModule } from '../sorting-stage2/grade-output/grade-output.module';
import { WasteModule } from '../waste/waste.module';

import { SortingStage1FacadeController } from './stage-1/sorting-stage1-facade.controller';
import { SortingStage2FacadeController } from './stage-2/sorting-stage2-facade.controller';
import { SortingOutputsFacadeController } from './outputs/sorting-outputs-facade.controller';

@Module({
  imports: [
    RagModule,
    IncomingBaleModule,

    SortSessionModule,
    SortCategoryBucketModule,
    CategoryOutputModule,

    GradeSessionModule,
    GradeBucketModule,
    GradeOutputModule,

    WasteModule,
  ],
  controllers: [SortingStage1FacadeController, SortingStage2FacadeController, SortingOutputsFacadeController],
})
export class SortingFacadeModule {}
