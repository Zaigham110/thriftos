import { Injectable } from '@nestjs/common';
import { SequenceScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SequenceFormatOptions {
  prefix?: string;
  padSize?: number;
  includeYear?: boolean;
  delimiter?: string;
  suffix?: string;
  yearOverride?: number;
}

@Injectable()
export class TenantSequenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Claims the next numeric value for a tenant + scope pair.
   * Uses an upsert wrapped in a transaction to avoid race conditions.
   */
  async next(tenantId: string, scope: SequenceScope): Promise<number> {
    const record = await this.prisma.$transaction((tx) =>
      tx.tenantSequence.upsert({
        where: { tenantId_scope: { tenantId, scope } },
        update: { nextNumber: { increment: 1 } },
        create: { tenantId, scope, nextNumber: 2 },
      }),
    );

    return Math.max(record.nextNumber - 1, 1);
  }

  /**
   * Builds a human-readable code for a claimed sequence number.
   */
  formatCode(sequence: number, options: SequenceFormatOptions = {}): string {
    const delimiter = options.delimiter ?? '-';
    const padSize = options.padSize ?? 4;
    const includeYear = options.includeYear ?? true;
    const year = options.yearOverride ?? new Date().getFullYear();

    const parts: string[] = [];

    if (options.prefix) {
      parts.push(options.prefix);
    }

    if (includeYear) {
      parts.push(String(year));
    }

    parts.push(sequence.toString().padStart(padSize, '0'));

    if (options.suffix) {
      parts.push(options.suffix);
    }

    return parts.join(delimiter);
  }

  /**
   * Generates a formatted code, retrying if the consumer reports a collision.
   */
  async generateCode(
    tenantId: string,
    scope: SequenceScope,
    options?: SequenceFormatOptions,
    uniquenessCheck?: (code: string) => Promise<boolean>,
  ): Promise<{ code: string; sequence: number }> {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const sequence = await this.next(tenantId, scope);
      const code = this.formatCode(sequence, options);

      if (!uniquenessCheck || (await uniquenessCheck(code))) {
        return { code, sequence };
      }
    }

    throw new Error(`Unable to generate unique code for scope ${scope}`);
  }
}
