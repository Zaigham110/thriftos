import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { BalesController } from './bales/bales.controller';
import { AuthGuard } from './common/auth.guard';
import { PrismaService } from './common/prisma.service';
import { CustomersController } from './customers/customers.controller';
import { DeviceController } from './device/device.controller';
import { DrawerController } from './drawer/drawer.controller';
import { ReportsController } from './reports/reports.controller';
import { StockController } from './stock/stock.controller';
import { SalesController } from './sales/sales.controller';
import { SalesService } from './sales/sales.service';
import { ShipmentsController } from './shipments/shipments.controller';
import { ShipmentsService } from './shipments/shipments.service';
import { ShopController } from './shop/shop.controller';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error('Set JWT_SECRET (16 letters or more) before starting the POS server.');
  return secret;
}

@Module({
  imports: [
    // A counter stays signed in for a month; stopping a cashier in Settings ends it at once (the guard checks).
    JwtModule.registerAsync({ useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: '30d' } }) }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [AuthController, ShopController, ShipmentsController, BalesController, SalesController, CustomersController, DrawerController, StockController, ReportsController, DeviceController],
  providers: [PrismaService, ShipmentsService, SalesService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
