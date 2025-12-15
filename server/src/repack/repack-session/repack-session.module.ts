import { Module } from '@nestjs/common';
import { RepackSessionController } from './repack-session.controller';
import { RepackSessionService } from './repack-session.service';

@Module({
  controllers: [RepackSessionController],
  providers: [RepackSessionService],
  exports: [RepackSessionService],
})
export class RepackSessionModule {}


