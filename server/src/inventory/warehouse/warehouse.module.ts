import { Module } from '@nestjs/common';
import { InventoryWarehouseController } from './warehouse.controller';
import { InventoryWarehouseService } from './warehouse.service';

@Module({
  controllers: [InventoryWarehouseController],
  providers: [InventoryWarehouseService],
  exports: [InventoryWarehouseService],
})
export class InventoryWarehouseModule {}


