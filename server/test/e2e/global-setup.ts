import { execSync } from 'child_process';
import * as path from 'path';
import { resolveTestDatabaseUrl } from './test-db';

/** Recreates the test database from migrations and runs the base seed (permissions, templates). */
export default function globalSetup(): void {
  const repoRoot = path.resolve(__dirname, '../../..');
  // ALLOW_DEV_MIGRATE is dropped so the seed guard is strict too: tests only ever reset a *_test database.
  const { ALLOW_DEV_MIGRATE: _ignored, ...env } = process.env;
  execSync('npx prisma migrate reset --force --schema prisma/schema.prisma', {
    cwd: repoRoot,
    stdio: 'pipe',
    env: { ...env, DATABASE_URL: resolveTestDatabaseUrl() },
  });
}
