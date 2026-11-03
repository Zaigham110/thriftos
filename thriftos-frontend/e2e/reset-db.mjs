// Resets the Playwright database and seeds the base data (super admin, demo tenant). Refuses anything
// but a *_test database: scripts/db-guard.js runs inside the root db:reset script, and
// ALLOW_DEV_MIGRATE is dropped so that guard is strict here.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.PW_DATABASE_URL || 'postgresql://thriftos:thriftos@localhost:5432/thriftos_pw_test?schema=public';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { ALLOW_DEV_MIGRATE: _ignored, ...env } = process.env;
execSync('npm run --silent db:reset -- --force', { cwd: root, stdio: 'inherit', env: { ...env, DATABASE_URL: url } });
