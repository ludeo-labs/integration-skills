#!/usr/bin/env node
// Stamps the next release version into SKILL.md frontmatter (metadata.version).
// Invoked by @semantic-release/exec during the prepare step.
//
// Usage: node scripts/bump-skill-version.mjs <version>
//   <version> is the bare semver (e.g. "1.2.3"), no leading "v".

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_PATH = resolve(ROOT, "SKILL.md");

const version = process.argv[2];
if (!version) {
  console.error("ERROR: version argument required (e.g. 1.2.3)");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`ERROR: "${version}" is not valid semver`);
  process.exit(1);
}

const text = readFileSync(SKILL_PATH, "utf8");
const fmMatch = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/);
if (!fmMatch) {
  console.error("ERROR: SKILL.md has no YAML frontmatter");
  process.exit(1);
}

const [, openFence, fmBody, closeFence] = fmMatch;
let newFmBody;

if (/^metadata:\s*$/m.test(fmBody)) {
  if (/^\s+version:\s*.*$/m.test(fmBody)) {
    newFmBody = fmBody.replace(/^(\s+)version:\s*.*$/m, `$1version: ${version}`);
  } else {
    newFmBody = fmBody.replace(/^(metadata:\s*)$/m, `$1\n  version: ${version}`);
  }
} else {
  newFmBody = `${fmBody.trimEnd()}\nmetadata:\n  version: ${version}`;
}

const updated = text.replace(fmMatch[0], `${openFence}${newFmBody}${closeFence}`);
writeFileSync(SKILL_PATH, updated, "utf8");

console.log(`Stamped SKILL.md metadata.version = ${version}`);
