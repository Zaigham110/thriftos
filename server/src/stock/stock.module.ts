import { Module } from '@nestjs/common';
import { BaleService } from './bale.service';
import { InventoryService } from './inventory.service';
import { BalesController, StockItemsController } from './stock.controller';

/** Finished bales (with QR) and sellable stock items. */
@Module({
  controllers: [BalesController, StockItemsController],
  providers: [BaleService, InventoryService],
})
export class StockModule {}
