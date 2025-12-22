import { Module } from '@nestjs/common';
import { GradeSessionModule } from './grade-session/grade-session.module';
import { GradeBucketModule } from './grade-bucket/grade-bucket.module';
import { GradeOutputModule } from './grade-output/grade-output.module';
import { GradesModule } from './grades/grades.module';

@Module({
  imports: [GradeSessionModule, GradeBucketModule, GradeOutputModule, GradesModule],
})
export class SortingStage2Module {}


