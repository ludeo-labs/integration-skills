#!/usr/bin/env node
// Scaffold a new skill from templates/skill-template.
//
// Usage: npm run new-skill -- <skill-name>

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'templates', 'skill-template');

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: npm run new-skill -- <kebab-case-name>');
  process.exit(1);
}

const dest = join(ROOT, 'skills', name);
if (existsSync(dest)) {
  console.error(`skills/${name} already exists.`);
  process.exit(1);
}
if (!existsSync(TEMPLATE)) {
  console.error('templates/skill-template is missing.');
  process.exit(1);
}

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    if (statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      let content = readFileSync(s, 'utf8');
      content = content.replaceAll('{{SKILL_NAME}}', name);
      writeFileSync(d, content);
    }
  }
}

copyDir(TEMPLATE, dest);
console.log(`Scaffolded skills/${name}. Next: fill in SKILL.md, then run \`npm run validate\` and \`npm run build-registry\`.`);
