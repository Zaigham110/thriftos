// node --test scripts/db-guard.test.js  (also run in CI)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { checkDatabase, assertSafeToMigrate, resolveDatabaseUrl, decideCommand } = require('./db-guard');

const DEV = 'postgresql://labur:pw@localhost:5432/thriftos?schema=public';
const TEST = 'postgresql://labur:pw@localhost:5432/thriftos_test?schema=public';
const REPO = path.resolve(__dirname, '..');

function tmpRoot(envFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-guard-'));
  if (envFile !== undefined) fs.writeFileSync(path.join(dir, '.env'), envFile);
  return dir;
}

test('allows only *_test databases by default', () => {
  assert.equal(checkDatabase(TEST, {}).ok, true);
  assert.equal(checkDatabase(DEV, {}).ok, false);
  assert.equal(checkDatabase('postgresql://u@h/thriftos_test_copy', {}).ok, false);
  assert.equal(checkDatabase('postgresql://u@h/test', {}).ok, false);
  assert.equal(checkDatabase(undefined, {}).ok, false);
  assert.equal(checkDatabase('not a url', {}).ok, false);
});

test('ALLOW_DEV_MIGRATE=1 (and only exactly 1) allows another database', () => {
  assert.equal(checkDatabase(DEV, { ALLOW_DEV_MIGRATE: '1' }).ok, true);
  for (const v of ['0', 'true', 'yes', '']) assert.equal(checkDatabase(DEV, { ALLOW_DEV_MIGRATE: v }).ok, false);
});

test('reads DATABASE_URL like Prisma: environment first, then root .env', () => {
  const root = tmpRoot(`# comment\nDATABASE_URL="${DEV}"\n`);
  assert.equal(resolveDatabaseUrl({}, root), DEV);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: TEST }, root), TEST);
  assert.throws(() => assertSafeToMigrate('migrate', {}, root), /Refusing to migrate: database "thriftos"/);
  assert.equal(assertSafeToMigrate('migrate', { DATABASE_URL: TEST }, root).dbName, 'thriftos_test');
  assert.throws(() => assertSafeToMigrate('seed', {}, tmpRoot()), /DATABASE_URL is not set/);
});

test('CLI exits 1 for the dev DB and 0 for a test DB', () => {
  const run = (env) => spawnSync(process.execPath, [path.join(__dirname, 'db-guard.js'), 'migrate'], { env, encoding: 'utf8' });
  const refused = run({ PATH: process.env.PATH, DATABASE_URL: DEV });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to migrate/);
  assert.equal(run({ PATH: process.env.PATH, DATABASE_URL: TEST }).status, 0);
  assert.equal(run({ PATH: process.env.PATH, DATABASE_URL: DEV, ALLOW_DEV_MIGRATE: '1' }).status, 0);
});

test('every npm db:* script that writes is refused for the dev DB before Prisma runs', () => {
  const scripts = require('../package.json').scripts;
  for (const name of ['db:migrate', 'db:migrate:prod', 'db:push', 'db:seed', 'db:reset']) {
    assert.match(scripts[name], /^node scripts\/db-guard\.js "[^"]+" && prisma /, name);
    const r = spawnSync('npm', ['run', '--silent', name], {
      cwd: REPO,
      env: { PATH: process.env.PATH, HOME: os.tmpdir(), DATABASE_URL: DEV },
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, `${name} should fail`);
    assert.match(r.stderr, /db-guard: Refusing/, name);
  }
});

test('seed, Docker entrypoint, e2e setup and apply scripts all carry the guard', () => {
  const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
  assert.match(read('prisma/seed.ts'), /require\('\.\.\/scripts\/db-guard\.js'\)\.assertSafeToMigrate\('seed'\)/);
  const entry = read('server/docker-entrypoint.sh');
  assert.ok(entry.indexOf('db-guard.js') > -1 && entry.indexOf('db-guard.js') < entry.indexOf('prisma migrate deploy'));
  assert.match(read('server/test/e2e/test-db.ts'), /must end in _test/);
  assert.match(read('server/test/e2e/global-setup.ts'), /ALLOW_DEV_MIGRATE: _ignored/);
  for (const p of ['scripts/apply-phase1.sh', 'scripts/apply-phase2.sh', 'scripts/apply-phase3.sh']) {
    const s = read(p);
    assert.ok(s.indexOf('[ ! -t 0 ]') > -1 && s.indexOf('[ ! -t 0 ]') < s.indexOf('prisma migrate deploy'), p);
  }
  const hook = JSON.parse(read('.claude/settings.json')).hooks.PreToolUse[0];
  assert.equal(hook.matcher, 'Bash');
  assert.match(hook.hooks[0].command, /db-guard\.js" --hook$/);
});

test('apply script refuses a non-interactive run against the dev DB', () => {
  const root = tmpRoot(`DATABASE_URL=${DEV}\n`);
  const r = spawnSync('bash', [path.join(REPO, 'scripts/apply-phase2.sh')], {
    env: { PATH: process.env.PATH, HOME: root, ENV_FILE: path.join(root, '.env') },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Refusing: thriftos is not a \*_test database/);
});

test('agent hook: blocks Prisma writes to the dev DB, allows test DBs and read-only commands', () => {
  const root = tmpRoot(`DATABASE_URL=${DEV}\n`);
  const d = (cmd, env = {}) => decideCommand(cmd, env, root).decision;
  // Dev DB (from .env) → deny
  assert.equal(d('npx prisma migrate deploy --schema prisma/schema.prisma'), 'deny');
  assert.equal(d('cd /x && npx prisma migrate dev'), 'deny');
  assert.equal(d('npx prisma migrate reset --force'), 'deny');
  assert.equal(d('npx prisma db push'), 'deny');
  assert.equal(d('npx prisma db seed'), 'deny');
  assert.equal(d('npx prisma migrate resolve --applied x'), 'deny');
  assert.equal(d('npm run db:reset'), 'deny');
  assert.equal(d(`npx prisma db execute --url "${DEV}" --file x.sql`), 'deny');
  // A *_test target → allow
  assert.equal(d(`DATABASE_URL=${TEST} npx prisma migrate deploy`), 'allow');
  assert.equal(d(`DATABASE_URL="${TEST}" npx prisma migrate reset --force`), 'allow');
  assert.equal(d('npx prisma migrate deploy', { DATABASE_URL: TEST }), 'allow');
  // Inline URL overrides a *_test environment
  assert.equal(d(`DATABASE_URL=${DEV} npx prisma migrate deploy`, { DATABASE_URL: TEST }), 'deny');
  // Explicit opt-in → the owner is asked
  assert.equal(d('ALLOW_DEV_MIGRATE=1 npx prisma migrate deploy'), 'ask');
  // The owner's apply scripts are never run by an agent unasked
  assert.equal(d('bash scripts/apply-phase2.sh'), 'ask');
  assert.equal(d(`ENV_FILE=/tmp/x.env CONTAINER=scratch bash scripts/apply-phase2.sh`), 'ask');
  // Read-only and unrelated → allow
  for (const cmd of ['npx prisma migrate status', 'npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma', 'npx prisma generate', 'npm test', 'git status']) {
    assert.equal(d(cmd), 'allow', cmd);
  }
});

test('agent hook speaks the PreToolUse JSON protocol', () => {
  const hook = (command) =>
    execFileSync(process.execPath, [path.join(__dirname, 'db-guard.js'), '--hook'], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      env: { PATH: process.env.PATH, DATABASE_URL: DEV },
      encoding: 'utf8',
    });
  const out = JSON.parse(hook('npx prisma migrate deploy'));
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(hook('ls'), '');
});
