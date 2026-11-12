import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollController, SortingWorkersController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule],
  controllers: [PayrollController, SortingWorkersController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
