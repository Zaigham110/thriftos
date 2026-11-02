import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const SCOPE = 'idempotency:scope';

/**
 * Makes a POST safe to repeat when the request carries an Idempotency-Key (offline sync, double taps).
 * The key is reserved before the handler runs, so a repeat can never write twice: a finished repeat gets
 * the first response back, one that arrives while the first is still running gets 409. If the handler
 * fails, the reservation is removed so the same key can be retried.
 */
export const Idempotent = (scope: string) => applyDecorators(SetMetadata(SCOPE, scope), UseInterceptors(IdempotentInterceptor));

@Injectable()
export class IdempotentInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scope = this.reflector.get<string>(SCOPE, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const key: string | undefined = req.headers['idempotency-key'];
    const tenantId: string | undefined = req.tenantId || req.user?.tenantId;
    if (!scope || key === undefined || !tenantId) return next.handle();
    if (!key.trim() || key.length > 200) throw new BadRequestException('Idempotency-Key must be 1 to 200 characters');

    return from(this.reserve(tenantId, scope, key)).pipe(
      mergeMap((stored) => {
        if (stored !== undefined) return of(stored);
        return next.handle().pipe(
          mergeMap((response) => from(this.save(tenantId, scope, key, response))),
          catchError((error) => from(this.release(tenantId, scope, key)).pipe(mergeMap(() => throwError(() => error)))),
        );
      }),
    );
  }

  /** undefined = reserved for this request; otherwise the stored response of the first request. */
  private async reserve(tenantId: string, scope: string, key: string): Promise<unknown> {
    try {
      await this.prisma.idempotencyKey.create({ data: { tenantId, scope, key } });
      return undefined;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope, key } },
      select: { responseJson: true },
    });
    if (row?.responseJson != null) return row.responseJson;
    throw new ConflictException('This entry is still being saved. Try again in a moment.');
  }

  private async save(tenantId: string, scope: string, key: string, response: unknown): Promise<unknown> {
    const json = JSON.parse(JSON.stringify(response ?? null)) as Prisma.InputJsonValue;
    await this.prisma.idempotencyKey.update({
      where: { tenantId_scope_key: { tenantId, scope, key } },
      data: { responseJson: json ?? {} },
    });
    return json;
  }

  private async release(tenantId: string, scope: string, key: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({ where: { tenantId, scope, key, responseJson: { equals: Prisma.DbNull } } });
  }
}
