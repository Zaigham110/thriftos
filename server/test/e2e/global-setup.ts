import { execSync } from 'child_process';
import * as path from 'path';
import { resolveTestDatabaseUrl } from './test-db';

/** Recreates the test database from migrations and runs the base seed (permissions, templates). */
export default function globalSetup(): void {
  const repoRoot = path.resolve(__dirname, '../../..');
  execSync('npx prisma migrate reset --force --schema prisma/schema.prisma', {
    cwd: repoRoot,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
  });
}
