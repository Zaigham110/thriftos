import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { reportError } from './sentry';

/** Unexpected errors (not HttpExceptions below 500) go to error tracking; responses are Nest's own. */
@Catch()
export class ServerErrorsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      const req = host.switchToHttp().getRequest<{ method?: string; route?: { path?: string }; user?: { userId?: string; tenantId?: string | null } }>();
      reportError(exception, { method: req?.method, route: req?.route?.path, tenantId: req?.user?.tenantId ?? undefined, userId: req?.user?.userId });
    }
    super.catch(exception, host);
  }
}
