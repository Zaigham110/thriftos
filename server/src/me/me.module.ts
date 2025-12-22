import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [UsersModule, CommonModule],
  controllers: [MeController],
})
export class MeModule {}
