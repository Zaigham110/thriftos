import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** Another request with the same key committed first. */
class KeyTaken extends Error {}

/**
 * Makes a write safe to repeat (offline sync, double taps): the first request with an
 * Idempotency-Key does the work and stores its response in the same transaction; a repeat
 * returns the stored response and writes nothing. Keys are per tenant and per scope.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(tenantId: string, scope: string, key: string | undefined, work: (tx: Tx) => Promise<T>): Promise<T> {
    if (key === undefined) return this.prisma.$transaction(work, { timeout: 15_000 });
    if (!key.trim() || key.length > 200) throw new BadRequestException('Idempotency-Key must be 1 to 200 characters');

    const stored = await this.stored<T>(tenantId, scope, key);
    if (stored !== undefined) return stored;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          try {
            await tx.idempotencyKey.create({ data: { tenantId, scope, key } });
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new KeyTaken();
            throw e;
          }
          // Stored and returned in the same JSON form, so a repeat gets exactly the first response.
          const response = JSON.parse(JSON.stringify(await work(tx))) as T;
          await tx.idempotencyKey.update({
            where: { tenantId_scope_key: { tenantId, scope, key } },
            data: { responseJson: response as Prisma.InputJsonValue },
          });
          return response;
        },
        { timeout: 15_000 },
      );
    } catch (e) {
      if (e instanceof KeyTaken) return (await this.stored<T>(tenantId, scope, key))!;
      throw e;
    }
  }

  private async stored<T>(tenantId: string, scope: string, key: string): Promise<T | undefined> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope, key } },
      select: { responseJson: true },
    });
    return row ? (row.responseJson as T) : undefined;
  }
}
