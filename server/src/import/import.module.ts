import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [CommonModule, AuditModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
