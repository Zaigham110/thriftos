import { Module } from '@nestjs/common';
import { InventoryItemModule } from './inventory-item/inventory-item.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { InventoryWarehouseModule } from './warehouse/warehouse.module';

@Module({
  imports: [InventoryItemModule, StockMovementModule, InventoryWarehouseModule],
})
export class InventoryModule {}


