// CI check for the en/ur dictionaries and for text that skips them.  node scripts/i18n-check.mjs
//  1. en.json and ur.json have the same keys, no empty values, the same {placeholders}, no Urdu digits.
//  2. Every key the code uses ('x.y' | t, t('x.y'), label: 'nav.x') exists.
//  3. Screens listed in TRANSLATED have no hard-coded visible text in their templates
//     (text between tags, placeholder, aria-label, title). Brand names in ALLOWED are fine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src/app');
const read = (p) => fs.readFileSync(p, 'utf8');
const errors = [];

const flat = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const en = Object.fromEntries(flat(JSON.parse(read(path.join(root, 'public/i18n/en.json')))));
const ur = Object.fromEntries(flat(JSON.parse(read(path.join(root, 'public/i18n/ur.json')))));

for (const k of new Set([...Object.keys(en), ...Object.keys(ur)])) {
  if (!(k in en)) errors.push(`en.json is missing ${k}`);
  if (!(k in ur)) errors.push(`ur.json is missing ${k}`);
  if (en[k] === '' || ur[k] === '') errors.push(`${k} is empty`);
  const ph = (s) => [...String(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  if (k in en && k in ur && ph(en[k]) !== ph(ur[k])) errors.push(`${k}: placeholders differ (en {${ph(en[k])}} / ur {${ph(ur[k])}})`);
  if (/[٠-٩۰-۹]/.test(ur[k] ?? '')) errors.push(`${k}: Urdu digits in ur.json (numbers stay Western)`);
}

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(f.name) && !f.name.endsWith('.spec.ts')) files.push(p);
  }
};
walk(src);

const used = /'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)'\s*\|\s*t\b|\bt\(\s*'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)'|\blabel(?:Key)?:\s*'([a-z][A-Za-z0-9]*\.[A-Za-z0-9_.]+)'/g;
for (const f of files) {
  for (const m of read(f).matchAll(used)) {
    const key = m[1] || m[2] || m[3];
    if (!(key in en)) errors.push(`${path.relative(root, f)} uses unknown key ${key}`);
  }
}

// Screens that must have no hard-coded visible text (grows as screens are rewritten).
const TRANSLATED = ['shell/', 'shared/offline/', 'features/bill/'];
const ALLOWED = /^(ThriftOS|Rs|kg|QR|PKR|USD|A4|اردو|English|[-–—·•×+−/%:()|.,0-9\s]*)$/;

for (const f of files.filter((p) => TRANSLATED.some((t) => path.relative(src, p).startsWith(t)))) {
  const text = read(f);
  const templates = f.endsWith('.html') ? [text] : [...text.matchAll(/template:\s*`([\s\S]*?)`,\s*\n\s*(?:styles|changeDetection|host|providers)/g)].map((m) => m[1]);
  for (const tpl of templates) {
    const clean = tpl.replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    for (const m of clean.matchAll(/>([^<>]+)</g)) {
      const s = m[1].replace(/@(if|else|for|empty|switch|case|default)\b[^{]*\{|\}/g, ' ').trim();
      if (s && /[A-Za-z؀-ۿ]{2,}/.test(s) && !ALLOWED.test(s)) errors.push(`${path.relative(root, f)}: hard-coded text "${s.slice(0, 60)}"`);
    }
    for (const m of clean.matchAll(/\s(placeholder|aria-label|title|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/g)) {
      if (!ALLOWED.test(m[2])) errors.push(`${path.relative(root, f)}: hard-coded ${m[1]}="${m[2]}"`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errors.length} i18n problem(s).`);
  process.exit(1);
}
console.log(`i18n ok: ${Object.keys(en).length} keys in en and ur, ${files.length} files checked.`);
