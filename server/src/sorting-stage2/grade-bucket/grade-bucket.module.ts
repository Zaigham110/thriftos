import { Module } from '@nestjs/common';
import { GradeBucketController } from './grade-bucket.controller';
import { GradeBucketService } from './grade-bucket.service';

@Module({
  controllers: [GradeBucketController],
  providers: [GradeBucketService],
  exports: [GradeBucketService],
})
export class GradeBucketModule {}


