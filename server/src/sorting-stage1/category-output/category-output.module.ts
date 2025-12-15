import { Module } from '@nestjs/common';
import { CategoryOutputController } from './category-output.controller';
import { CategoryOutputService } from './category-output.service';

@Module({
  controllers: [CategoryOutputController],
  providers: [CategoryOutputService],
  exports: [CategoryOutputService],
})
export class CategoryOutputModule {}


