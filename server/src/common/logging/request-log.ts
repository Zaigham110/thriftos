import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { LoggerService } from '@nestjs/common';

/**
 * One JSON line per API request (production, or LOG_REQUESTS=1): time, request id, method, path without
 * the query string, status, duration and the signed-in business/user ids. No IPs, query strings, bodies
 * or names, so the log holds no personal data. The request id is CloudFront's (X-Amz-Cf-Id) when there is
 * one, else the caller's X-Request-Id, else a new one; it is sent back as X-Request-Id.
 */
const ID = /^[A-Za-z0-9_=-]{8,80}$/;

export function requestIdOf(headers: Record<string, string | string[] | undefined>): string {
  for (const name of ['x-amz-cf-id', 'x-request-id']) {
    const v = headers[name];
    const id = Array.isArray(v) ? v[0] : v;
    if (id && ID.test(id)) return id;
  }
  return randomUUID();
}

export interface RequestLogFields {
  reqId: string;
  method: string;
  url: string;
  status: number;
  ms: number;
  tenantId?: string | null;
  userId?: string;
}

export function requestLogLine(f: RequestLogFields, now = new Date()): string {
  return JSON.stringify({
    t: now.toISOString(),
    level: f.status >= 500 ? 'error' : f.status >= 400 ? 'warn' : 'info',
    msg: 'request',
    reqId: f.reqId,
    method: f.method,
    path: f.url.split('?')[0],
    status: f.status,
    ms: Math.round(f.ms),
    tenantId: f.tenantId ?? undefined,
    userId: f.userId ?? undefined,
  });
}

export function requestLogsEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.LOG_REQUESTS === '1' || (env.NODE_ENV === 'production' && env.LOG_REQUESTS !== '0');
}

export function requestLogger(write: (line: string) => void = (l) => process.stdout.write(l + '\n')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const reqId = requestIdOf(req.headers);
    res.setHeader('X-Request-Id', reqId);
    res.on('finish', () => {
      const user = (req as Request & { user?: { userId?: string; tenantId?: string | null; impersonatedTenantId?: string } }).user;
      write(
        requestLogLine({
          reqId,
          method: req.method,
          url: req.originalUrl || req.url,
          status: res.statusCode,
          ms: Number(process.hrtime.bigint() - start) / 1e6,
          tenantId: user?.impersonatedTenantId ?? user?.tenantId,
          userId: user?.userId,
        }),
      );
    });
    next();
  };
}

/** Nest's own logs as JSON lines in production (same shape as request lines). */
export class JsonLogger implements LoggerService {
  private line(level: string, message: unknown, context?: string, extra?: Record<string, unknown>) {
    const text = message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message);
    process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, msg: text, context, ...extra }) + '\n');
  }
  log(message: unknown, context?: string) { this.line('info', message, context); }
  warn(message: unknown, context?: string) { this.line('warn', message, context); }
  debug(message: unknown, context?: string) { this.line('debug', message, context); }
  verbose(message: unknown, context?: string) { this.line('debug', message, context); }
  error(message: unknown, stack?: string, context?: string) { this.line('error', message, context, stack ? { stack } : undefined); }
}
