import { Module } from '@nestjs/common';
import { SortSessionModule } from './sort-session/sort-session.module';
import { SortCategoryBucketModule } from './sort-category-bucket/sort-category-bucket.module';
import { CategoryOutputModule } from './category-output/category-output.module';

@Module({
  imports: [SortSessionModule, SortCategoryBucketModule, CategoryOutputModule],
})
export class SortingStage1Module {}


