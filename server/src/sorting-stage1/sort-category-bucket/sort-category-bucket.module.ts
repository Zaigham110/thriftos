import { Module } from '@nestjs/common';
import { SortCategoryBucketController } from './sort-category-bucket.controller';
import { SortCategoryBucketService } from './sort-category-bucket.service';

@Module({
  controllers: [SortCategoryBucketController],
  providers: [SortCategoryBucketService],
  exports: [SortCategoryBucketService],
})
export class SortCategoryBucketModule {}


