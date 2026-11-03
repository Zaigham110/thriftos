import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { reportError } from './sentry';

export class ClientErrorDto {
  @IsString() @MaxLength(500) message!: string;
  @IsString() @MaxLength(4000) @IsOptional() stack?: string;
  /** App route where it happened (no query string). */
  @IsString() @MaxLength(300) @IsOptional() path?: string;
  @IsString() @MaxLength(40) @IsOptional() version?: string;
}

/** Errors from the app in the browser: logged as JSON (and sent to error tracking when it is on). */
@ApiTags('Health')
@Controller('client-errors')
export class ClientErrorsController {
  @Post()
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  report(@Body() dto: ClientErrorDto): void {
    const path = dto.path?.split('?')[0];
    process.stdout.write(
      JSON.stringify({ t: new Date().toISOString(), level: 'error', msg: 'client-error', source: 'web', error: dto.message, path, version: dto.version, stack: dto.stack }) + '\n',
    );
    const error = new Error(dto.message);
    error.name = 'ClientError';
    if (dto.stack) error.stack = dto.stack;
    reportError(error, { source: 'web', path, version: dto.version });
  }
}
