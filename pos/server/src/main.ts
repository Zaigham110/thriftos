import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from './app.module';

// Development reads pos/server/.env; in Docker the values come from the environment.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  // Held bills and print jobs are bigger than the usual small request.
  app.useBodyParser('json', { limit: '1mb' });

  // In a shop the same server also hands out the screens, so there is one thing to run.
  const webDir = process.env.WEB_DIR ? resolve(process.env.WEB_DIR) : '';
  if (webDir && existsSync(join(webDir, 'index.html'))) {
    // Built files carry a hash in their name and never change; the offline worker's own files must always be fresh.
    const fresh = /(^|\/)(ngsw-worker\.js|ngsw\.json|safety-worker\.js|manifest\.webmanifest|favicon\.svg|icon-\d+\.png)$/;
    app.use(
      express.static(webDir, {
        index: false,
        setHeaders: (res, file) => res.setHeader('Cache-Control', fresh.test(file) ? 'no-cache' : 'public, max-age=31536000, immutable'),
      }),
    );
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(webDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3100;
  await app.listen(port, '0.0.0.0');
  console.log(`ThriftOS Shop POS is running on port ${port}`);
}

void bootstrap();
