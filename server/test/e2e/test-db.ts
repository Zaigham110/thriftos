import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'dotenv';

/**
 * The e2e database URL: TEST_DATABASE_URL if set, otherwise DATABASE_URL (env or root .env)
 * with the database name suffixed by `_test`. Refuses any database whose name does not end
 * in `_test`, because the e2e run resets it.
 */
export function resolveTestDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const rootEnv = path.resolve(__dirname, '../../../.env');
    const base =
      process.env.DATABASE_URL ??
      (fs.existsSync(rootEnv) ? parse(fs.readFileSync(rootEnv)).DATABASE_URL : undefined);
    if (!base) {
      throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) to run e2e tests');
    }
    const parsed = new URL(base);
    if (!parsed.pathname.endsWith('_test')) {
      parsed.pathname = `${parsed.pathname}_test`;
    }
    url = parsed.toString();
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against "${dbName}": database name must end in _test`);
  }
  return url;
}
