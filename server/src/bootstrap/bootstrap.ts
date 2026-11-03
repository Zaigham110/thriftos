/**
 * Production bootstrap (in the server image as dist/bootstrap/bootstrap.js).
 *
 *   node dist/bootstrap/bootstrap.js --base
 *       Base data only (SYSTEM business, settings, templates, permissions). Idempotent; the container
 *       entrypoint runs it after migrations on every start.
 *
 *   SUPERADMIN_EMAIL=you@example.com node dist/bootstrap/bootstrap.js --super-admin
 *       Base data, then the first super admin if there is none yet, with a new random password that is
 *       printed once (sign in and keep it safe). Never changes an existing account. SUPERADMIN_PASSWORD
 *       may be given instead of a random one (at least 12 characters).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { ensureBaseData, ensureFirstSuperAdmin } from './base-data';

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== '--base' && mode !== '--super-admin') {
    console.error('Usage: bootstrap.js --base | --super-admin');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const systemTenantId = await ensureBaseData(prisma);
    console.log('Base data ready.');
    if (mode === '--base') return;

    const email = process.env.SUPERADMIN_EMAIL?.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Set SUPERADMIN_EMAIL to a valid email address.');
    const given = process.env.SUPERADMIN_PASSWORD;
    if (given !== undefined && given.length < 12) throw new Error('SUPERADMIN_PASSWORD must be at least 12 characters.');
    const password = given ?? randomBytes(12).toString('base64url');

    const created = await ensureFirstSuperAdmin(prisma, systemTenantId, email, await bcrypt.hash(password, 12));
    if (!created) {
      console.log('A super admin already exists; nothing changed.');
      return;
    }
    console.log(`Super admin created: ${email.toLowerCase()}`);
    if (given === undefined) console.log(`Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
