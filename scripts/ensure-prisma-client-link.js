#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function ensureSymlink({ packageDir }) {
  const nodeModulesDir = path.join(packageDir, 'node_modules');
  const prismaDir = path.join(nodeModulesDir, '.prisma');
  const prismaClientPkgDir = path.join(nodeModulesDir, '@prisma', 'client');
  const linkPath = path.join(prismaClientPkgDir, '.prisma');

  if (!fs.existsSync(nodeModulesDir)) {
    throw new Error(`node_modules not found at ${nodeModulesDir}`);
  }
  if (!fs.existsSync(prismaDir)) {
    throw new Error(`.prisma not found at ${prismaDir} (run prisma generate first)`);
  }
  if (!fs.existsSync(prismaClientPkgDir)) {
    throw new Error(`@prisma/client not found at ${prismaClientPkgDir} (install deps first)`);
  }

  // If it already exists and points somewhere, leave it alone.
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      return { ok: true, action: 'exists' };
    }
    // If it's a real directory/file, don't overwrite.
    return { ok: false, action: 'blocked', reason: `${linkPath} exists but is not a symlink` };
  } catch {
    // doesn't exist
  }

  // From node_modules/@prisma/client/.prisma to node_modules/.prisma
  const relativeTarget = path.relative(prismaClientPkgDir, prismaDir);
  fs.symlinkSync(relativeTarget, linkPath, 'dir');
  return { ok: true, action: 'created', target: relativeTarget };
}

function main() {
  const cwdFlagIndex = process.argv.indexOf('--cwd');
  const packageDir = cwdFlagIndex >= 0 ? process.argv[cwdFlagIndex + 1] : process.cwd();

  const resolved = path.resolve(packageDir);
  const result = ensureSymlink({ packageDir: resolved });

  if (!result.ok) {
    console.error(`Prisma symlink not created: ${result.reason}`);
    process.exit(1);
  }

  if (process.env.DEBUG_PRISMA_LINKS === '1') {
    console.log(`Prisma symlink: ${result.action}${result.target ? ` -> ${result.target}` : ''}`);
  }
}

main();
