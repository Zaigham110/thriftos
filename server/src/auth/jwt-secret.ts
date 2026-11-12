import { ConfigService } from '@nestjs/config';

/** The value that used to be built into the source; it is public, so it is never accepted on a live server. */
const OLD_BUILT_IN = 'thriftOSerp';
export const MIN_LIVE_SECRET = 32;

/**
 * The secret login tokens are signed with. There is no built-in value: the server does not start without
 * JWT_SECRET, and in production it must be long (32+ characters) and not the old public one.
 */
export function jwtSecret(config: Pick<ConfigService, 'get'>): string {
  const secret = (config.get<string>('JWT_SECRET') ?? '').trim();
  if (!secret) throw new Error('JWT_SECRET is not set. The server does not start without it.');
  if (config.get<string>('NODE_ENV') === 'production' && (secret.length < MIN_LIVE_SECRET || secret === OLD_BUILT_IN)) {
    throw new Error(`JWT_SECRET must be at least ${MIN_LIVE_SECRET} random characters in production.`);
  }
  return secret;
}
