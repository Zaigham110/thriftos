// npm run demo:reset — recreates the demo database `thriftos_demo` from scratch: migrations, base data
// (permissions, super admin), then the demo businesses made through the app's own services
// (server/src/demo/seed-demo.ts), and finally both data checks (they must return no rows).
//
// The demo database lives next to your dev DB on the same Postgres server, but it is a different database:
// DATABASE_URL (env or root .env) with the database name replaced by thriftos_demo, or DEMO_DATABASE_URL.
// It never touches any other database: scripts/db-guard.js allows thriftos_demo only while this runs.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_DB = 'thriftos_demo';

function rootEnv(name) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}

function demoUrl() {
  if (process.env.DEMO_DATABASE_URL) return process.env.DEMO_DATABASE_URL;
  const base = process.env.DATABASE_URL || rootEnv('DATABASE_URL');
  if (!base) throw new Error('Set DATABASE_URL (root .env) or DEMO_DATABASE_URL first.');
  const u = new URL(base);
  u.pathname = `/${DEMO_DB}`;
  return u.toString();
}

const url = demoUrl();
const name = decodeURIComponent(new URL(url).pathname.slice(1));
if (name !== DEMO_DB) {
  console.error(`Refusing: demo:reset only recreates "${DEMO_DB}", not "${name}".`);
  process.exit(1);
}

// No ALLOW_DEV_MIGRATE here: only the demo database (or a *_test one) passes the guard.
const { ALLOW_DEV_MIGRATE: _ignored, ...inherited } = process.env;
const env = { ...inherited, DATABASE_URL: url, THRIFTOS_DEMO_RESET: '1', SEED_BASE_ONLY: '1' };
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env });

console.log(`== demo:reset → ${new URL(url).host}/${name}`);
run('node scripts/db-guard.js "demo reset"');
run('npx prisma migrate reset --force --schema prisma/schema.prisma');
if (!fs.existsSync(path.join(root, 'server/dist/demo/seed-demo.js')) || process.env.DEMO_BUILD !== '0') {
  run('npm run build', path.join(root, 'server'));
}
run('node dist/demo/seed-demo.js', path.join(root, 'server'));
console.log(`== Demo ready in ${name}. Point the API at it with DATABASE_URL=${url.replace(/:[^:@/]+@/, ':****@')}`);
