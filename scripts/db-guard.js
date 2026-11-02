#!/usr/bin/env node
/*
 * Dev-DB guard. Anything automated that migrates, resets, pushes or seeds a database
 * (npm db:* scripts, prisma/seed.ts, the Docker entrypoint, the e2e setup) must call this
 * first. It refuses any database whose name does not end in `_test` unless ALLOW_DEV_MIGRATE=1.
 * Only the owner's apply scripts (scripts/apply-phase*.sh) migrate the dev DB.
 *
 *   node scripts/db-guard.js "<what is about to run>"   exits 1 if the target is not allowed
 *   node scripts/db-guard.js --hook                      Claude Code PreToolUse hook (JSON on stdin)
 *
 * The database is the one Prisma would use: DATABASE_URL from the environment, else the
 * root .env, else prisma/.env.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    out[m[1]] = value;
  }
  return out;
}

function resolveDatabaseUrl(env = process.env, root = REPO_ROOT) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return (
    readEnvFile(path.join(root, '.env')).DATABASE_URL ||
    readEnvFile(path.join(root, 'prisma', '.env')).DATABASE_URL ||
    undefined
  );
}

function databaseNameOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

/** { ok, dbName, reason } for a database URL. */
function checkDatabase(url, env = process.env) {
  if (!url) return { ok: false, dbName: '', reason: 'DATABASE_URL is not set' };
  const dbName = databaseNameOf(url);
  if (!dbName) return { ok: false, dbName, reason: 'cannot read a database name from DATABASE_URL' };
  if (dbName.endsWith('_test')) return { ok: true, dbName, reason: 'test database' };
  if (env.ALLOW_DEV_MIGRATE === '1') return { ok: true, dbName, reason: 'ALLOW_DEV_MIGRATE=1' };
  return {
    ok: false,
    dbName,
    reason: `database "${dbName}" does not end in _test (set ALLOW_DEV_MIGRATE=1 to allow it on purpose)`,
  };
}

function assertSafeToMigrate(action = 'migrate/reset/seed', env = process.env, root = REPO_ROOT) {
  const result = checkDatabase(resolveDatabaseUrl(env, root), env);
  if (!result.ok) {
    throw new Error(`Refusing to ${action}: ${result.reason}. The dev DB is changed only by scripts/apply-phase*.sh.`);
  }
  return result;
}

// ---- Claude Code PreToolUse hook -------------------------------------------------------

// Commands that change a database's schema or data through Prisma. Read-only ones
// (migrate status, migrate diff, generate, studio) are not listed.
const PRISMA_WRITE = /\bprisma\s+(?:migrate\s+(?:dev|deploy|reset|resolve)|db\s+(?:push|seed|execute))\b/;
const NPM_DB_SCRIPT = /\bnpm\s+(?:--prefix\s+\S+\s+)?run\s+db:(?:migrate|push|seed|reset|setup)\b|\bscripts\/setup-db\.sh\b/;
const APPLY_SCRIPT = /\bapply-phase\d*\.sh\b/;

function inlineVar(command, name) {
  const m = command.match(new RegExp(`(?:^|[\\s;&|(])(?:export\\s+)?${name}=("[^"]*"|'[^']*'|\\S+)`));
  return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
}

/** Decision for a shell command an agent is about to run: { decision: 'allow'|'ask'|'deny', reason }. */
function decideCommand(command, env = process.env, root = REPO_ROOT) {
  if (APPLY_SCRIPT.test(command)) {
    return {
      decision: 'ask',
      reason: 'apply-phase scripts migrate the dev DB; the owner runs them. Confirm only if you asked for this.',
    };
  }
  if (!PRISMA_WRITE.test(command) && !NPM_DB_SCRIPT.test(command)) return { decision: 'allow', reason: '' };

  const cmdEnv = { ...env };
  for (const name of ['DATABASE_URL', 'ALLOW_DEV_MIGRATE']) {
    const value = inlineVar(command, name);
    if (value !== undefined) cmdEnv[name] = value;
  }
  // An explicit --url / --shadow-database-url also names the target (prisma db execute, migrate diff).
  const urlFlag = command.match(/--url[ =]("[^"]*"|'[^']*'|\S+)/);
  if (urlFlag) cmdEnv.DATABASE_URL = urlFlag[1].replace(/^["']|["']$/g, '');

  const url = resolveDatabaseUrl(cmdEnv, root);
  const dbName = databaseNameOf(url || '');
  if (dbName.endsWith('_test')) return { decision: 'allow', reason: '' };
  if (cmdEnv.ALLOW_DEV_MIGRATE === '1') {
    return { decision: 'ask', reason: `This migrates/seeds "${dbName || '?'}" with ALLOW_DEV_MIGRATE=1.` };
  }
  return {
    decision: 'deny',
    reason:
      `Blocked: this would migrate/reset/seed "${dbName || 'the database in DATABASE_URL'}", which does not end in _test. ` +
      'Point DATABASE_URL at a *_test database; the dev DB is changed only by the owner via scripts/apply-phase*.sh.',
  };
}

function runHook() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    let command = '';
    try {
      command = String(JSON.parse(input).tool_input?.command ?? '');
    } catch {
      return;
    }
    const { decision, reason } = decideCommand(command);
    if (decision === 'allow') return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
      }),
    );
  });
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--hook') {
    runHook();
  } else {
    try {
      const { dbName, reason } = assertSafeToMigrate(arg || undefined);
      console.error(`db-guard: ok — "${dbName}" (${reason})`);
    } catch (err) {
      console.error(`db-guard: ${err.message}`);
      process.exit(1);
    }
  }
}

module.exports = { resolveDatabaseUrl, databaseNameOf, checkDatabase, assertSafeToMigrate, decideCommand };
