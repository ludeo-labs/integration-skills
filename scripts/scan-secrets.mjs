#!/usr/bin/env node
// Scan for secrets / sensitive data before they get committed.
// Used by the pre-commit hook. Exits non-zero and prints findings if anything looks like a secret.
//
// Usage:
//   node scripts/scan-secrets.mjs          # scan STAGED changes (default; what the hook runs)
//   node scripts/scan-secrets.mjs --all    # scan all tracked files in the working tree
//
// False positive? Add the marker `gitleaks:allow` on the offending line, or extend
// ALLOW_PATHS / PLACEHOLDER below. Keep real secrets in .env / *.template -> *.local files.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const ALL = process.argv.includes('--all');
const MAX_BYTES = 1024 * 1024; // skip files larger than 1MB

// --- Files that must never be committed, by name ---------------------------------------------
const FORBIDDEN_FILES = [
  /(^|\/)\.env(\..+)?$/i,                 // .env, .env.local, .env.production
  /(^|\/)ludeo-cli\.json$/i,              // real CLI config (the committed one is *.template.json)
  /\.(pem|pfx|p12|key|keystore|jks)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|\/)(credentials|secret|secrets)\.(json|ya?ml|txt)$/i,
];

// --- Paths EXPECTED to contain placeholder secrets (templates, examples, this scanner) -------
const ALLOW_PATHS = [
  /\.template\.[a-z0-9]+$/i,
  /(^|\/)templates\//,
  /\.example(\.[a-z0-9]+)?$/i,
  /(^|\/)\.gitleaks\.toml$/,
  /(^|\/)scripts\/scan-secrets\.mjs$/,    // documents the patterns themselves
  /(^|\/)\.github\/workflows\//,          // GitHub Actions reference ${{ secrets.* }}
];

// --- A captured value is a placeholder (not a real secret) if it matches any of these ---------
const PLACEHOLDER = [
  /^\$\{.*\}$/,                  // ${LUDEO_API_KEY}
  /^\$\{\{.*\}\}$/,             // ${{ secrets.X }}
  /^<.*>$/,                      // <your-key>
  /REPLACE|EXAMPLE|CHANGEME|CHANGE_ME|PLACEHOLDER|DUMMY|SAMPLE|TODO|FIXME/i,
  /^your[_-]/i,
  /^x{4,}$/i, /^\*{3,}$/, /^\.{3,}$/,
  /^[a-z0-9]{1,7}$/i,            // too short to be a real key
];

// --- Secret content rules: [name, regex, valueGroupIndex] -----------------------------------
const RULES = [
  ['Private key block',        /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/, 0],
  ['AWS access key id',        /\bAKIA[0-9A-Z]{16}\b/, 0],
  ['GitHub token',             /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/, 0],
  ['GitHub fine-grained PAT',  /\bgithub_pat_[A-Za-z0-9_]{60,}\b/, 0],
  ['Slack token',              /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 0],
  ['Google API key',           /\bAIza[0-9A-Za-z_-]{35}\b/, 0],
  ['JWT',                      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, 0],
  // Ludeo-specific — TUNE to the real key format. Catches `ludeoApiKey: "<value>"`, `LUDEO_TOKEN=...`.
  ['Ludeo key/secret/token',   /ludeo[_-]?(?:api[_-]?)?(?:key|secret|token)["']?\s*[:=]\s*["']?([^"'\s]{12,})/i, 1],
  // Generic keyword-assigned secret.
  ['Generic secret assignment', /\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\b["']?\s*[:=]\s*["']?([^"'\s]{8,})/i, 1],
];

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : '';
}

function stagedFiles() {
  return git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n').map(s => s.trim()).filter(Boolean);
}
function allTrackedFiles() {
  return git(['ls-files']).split('\n').map(s => s.trim()).filter(Boolean);
}
function contentOf(path) {
  if (ALL) {
    if (!existsSync(path)) return null;
    return readFileSync(path);
  }
  const r = spawnSync('git', ['show', `:${path}`], { maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

const files = ALL ? allTrackedFiles() : stagedFiles();
const findings = [];

function allowedPath(path) { return ALLOW_PATHS.some(re => re.test(path)); }
function isPlaceholder(v) { return PLACEHOLDER.some(re => re.test(v)); }
function mask(v) { return v.length <= 4 ? '****' : v.slice(0, 3) + '*'.repeat(Math.min(v.length - 3, 8)); }

for (const path of files) {
  // 1) Forbidden filename, regardless of content
  if (FORBIDDEN_FILES.some(re => re.test(path)) && !allowedPath(path)) {
    findings.push({ path, line: 0, rule: 'Sensitive file name', snippet: path });
    continue;
  }
  if (allowedPath(path)) continue;

  const buf = contentOf(path);
  if (buf == null) continue;
  if (buf.length > MAX_BYTES) continue;
  if (buf.includes(0)) continue; // binary
  const text = buf.toString('utf8');

  text.split('\n').forEach((line, i) => {
    if (/gitleaks:allow|pragma:\s*allowlist\s*secret/i.test(line)) return;
    for (const [name, re, group] of RULES) {
      const m = line.match(re);
      if (!m) continue;
      const value = group === 0 ? m[0] : (m[group] || '');
      if (group !== 0 && isPlaceholder(value)) continue;
      findings.push({ path, line: i + 1, rule: name, snippet: mask(value || m[0]) });
      break; // one finding per line is enough
    }
  });
}

if (findings.length === 0) {
  console.log(`scan-secrets: clean (${files.length} ${ALL ? 'tracked' : 'staged'} file(s) checked).`);
  process.exit(0);
}

console.error(`\nscan-secrets: ${findings.length} potential secret(s) found:\n`);
for (const f of findings) {
  const loc = f.line ? `${f.path}:${f.line}` : f.path;
  console.error(`  ✗ [${f.rule}] ${loc}  →  ${f.snippet}`);
}
console.error(`\nRemove the secret (use .env / a *.local file, ignored by .gitignore).`);
console.error(`If it's a false positive, add 'gitleaks:allow' on that line or extend scripts/scan-secrets.mjs.\n`);
process.exit(1);
