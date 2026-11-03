import { INestApplication, ValidationPipe } from '@nestjs/common';
import { requestLogger, requestLogsEnabled } from './common/logging/request-log';

/**
 * Express `trust proxy` from TRUST_PROXY: unset/empty → off; a number → that many proxies in front
 * (production has one, Caddy), so `req.ip` is the client's address for rate limits and the audit log.
 */
export function trustProxySetting(value: string | undefined): number | false {
  const hops = Number(value);
  return value?.trim() && Number.isInteger(hops) && hops > 0 ? hops : false;
}

/** API docs are served unless running in production (ENABLE_SWAGGER=1 turns them on there). */
export function swaggerEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV !== 'production' || env.ENABLE_SWAGGER === '1';
}

/** HTTP pipeline shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy) app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  if (requestLogsEnabled(process.env)) app.use(requestLogger());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}
