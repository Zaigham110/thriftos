import { Module } from '@nestjs/common';
import { BaleService } from './bale.service';
import { DirectStockService } from './direct-stock.service';
import { InventoryService } from './inventory.service';
import { BalesController, StockItemsController } from './stock.controller';

/** Finished bales (with QR), stock bought ready to sell, and sellable stock items. */
@Module({
  controllers: [BalesController, StockItemsController],
  providers: [BaleService, DirectStockService, InventoryService],
  exports: [DirectStockService],
})
export class StockModule {}
