import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FileStorageService } from '../common/storage/file-storage.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [CommonModule],
  controllers: [RecordsController],
  providers: [RecordsService, FileStorageService],
})
export class RecordsModule {}
