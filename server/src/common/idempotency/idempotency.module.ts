import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotentInterceptor } from './idempotent.interceptor';

@Global()
@Module({
  providers: [IdempotencyService, IdempotentInterceptor],
  exports: [IdempotencyService, IdempotentInterceptor],
})
export class IdempotencyModule {}
