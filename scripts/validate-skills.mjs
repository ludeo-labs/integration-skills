#!/usr/bin/env node
// Lint every skill's SKILL.md: required frontmatter, version agreement with package.json,
// and that relative markdown links resolve. Exits non-zero on any error.
//
// Usage: node scripts/validate-skills.mjs

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const MAX_SKILL_MD_BYTES = 32 * 1024; // keep SKILL.md lean; push detail into references/

const errors = [];
const warnings = [];

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_.]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function checkLinks(md, skillDir, name) {
  const linkRe = /\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(md))) {
    let target = m[1].split('#')[0].trim();
    if (!target || /^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue;
    // resolve relative to the skill dir; allow ../ into shared/
    const resolved = resolve(skillDir, target);
    if (!existsSync(resolved)) {
      errors.push(`[${name}] broken link: ${target}`);
    }
  }
}

if (!existsSync(SKILLS_DIR)) {
  console.error('No skills/ directory found.');
  process.exit(1);
}

const skillFolders = readdirSync(SKILLS_DIR).filter((f) => {
  const p = join(SKILLS_DIR, f);
  return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'));
});

if (skillFolders.length === 0) {
  console.warn('No skills with a SKILL.md found yet — nothing to validate.');
  process.exit(0);
}

for (const folder of skillFolders) {
  const skillDir = join(SKILLS_DIR, folder);
  const skillMdPath = join(skillDir, 'SKILL.md');
  const md = readFileSync(skillMdPath, 'utf8');

  const size = Buffer.byteLength(md, 'utf8');
  if (size > MAX_SKILL_MD_BYTES) {
    warnings.push(`[${folder}] SKILL.md is ${(size / 1024).toFixed(1)}KB (> ${MAX_SKILL_MD_BYTES / 1024}KB) — move detail into references/`);
  }

  const fm = parseFrontmatter(md);
  if (!fm) {
    errors.push(`[${folder}] missing YAML frontmatter`);
    continue;
  }
  if (!fm.name) errors.push(`[${folder}] frontmatter missing "name"`);
  if (!fm.description) errors.push(`[${folder}] frontmatter missing "description"`);
  if (fm.description && fm.description.length < 30) {
    warnings.push(`[${folder}] description is very short — make it trigger-specific`);
  }

  // version agreement between SKILL.md metadata.version and package.json
  const pkgPath = join(skillDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const fmVersion = fm['metadata.version'] || fm.version;
    if (fmVersion && pkg.version && fmVersion !== pkg.version) {
      errors.push(`[${folder}] version mismatch: SKILL.md ${fmVersion} vs package.json ${pkg.version}`);
    }
  }

  checkLinks(md, skillDir, folder);
}

for (const w of warnings) console.warn('WARN  ' + w);
for (const e of errors) console.error('ERROR ' + e);

console.log(`\nValidated ${skillFolders.length} skill(s): ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length > 0 ? 1 : 0);
