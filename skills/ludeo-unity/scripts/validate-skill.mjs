#!/usr/bin/env node
// Validates SKILL.md against the Agent Skills spec (https://agentskills.io/specification)
// and our local conventions, plus the learnings/ privacy + freshness invariants.
// Zero npm dependencies so it runs everywhere. Twin of skills/ludeo-unreal/scripts/
// validate-skill.mjs — keep the two in step when either changes.
//
// Exit codes:
//   0 — all checks passed (warnings allowed)
//   1 — one or more errors

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_PATH = join(ROOT, "SKILL.md");
const REFERENCES_DIR = join(ROOT, "references");
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESC = 1024;
const MAX_BODY_LINES = 500;

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function readFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    fail(`Cannot read ${relative(ROOT, path)}: ${e.message}`);
    return null;
  }
}

// Minimal YAML frontmatter parser — enough for our needs (top-level scalars
// and the `metadata:` map). Supports quoted/unquoted scalars and one level of
// nested mapping. NOT a general YAML parser.
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const out = {};
  let currentKey = null;
  let currentIndent = 0;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const m = line.match(/^([A-Za-z_][\w.-]*):\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      const dot = key.indexOf(".");
      if (rest === "") {
        out[key] = {};
        currentKey = key;
        currentIndent = indent;
      } else if (dot !== -1) {
        // Flat dotted key (monorepo convention, e.g. `metadata.version: 1.4.0`)
        // → nest it so consumers see fm.data.metadata.version. Also keeps the
        // nested `metadata:\n  version:` form working via the branch below.
        const parent = key.slice(0, dot);
        const child = key.slice(dot + 1);
        if (!out[parent] || typeof out[parent] !== "object") out[parent] = {};
        out[parent][child] = unquote(rest);
        currentKey = null;
      } else {
        out[key] = unquote(rest);
        currentKey = null;
      }
    } else if (currentKey && indent > currentIndent) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      out[currentKey][key] = unquote(rest);
    }
  }
  return { raw: match[1], data: out };
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// --- 1. SKILL.md frontmatter checks --------------------------------------------------

const skillText = readFile(SKILL_PATH);
if (!skillText) {
  console.error("FAIL: SKILL.md missing");
  process.exit(1);
}

const fm = parseFrontmatter(skillText);
if (!fm) {
  fail("SKILL.md is missing YAML frontmatter (--- ... ---)");
} else {
  const { name, description, metadata } = fm.data;

  if (!name) fail("frontmatter.name is required");
  else if (name.length > MAX_NAME) fail(`frontmatter.name exceeds ${MAX_NAME} chars`);
  else if (!NAME_RE.test(name))
    fail(`frontmatter.name "${name}" must match /^[a-z0-9]+(-[a-z0-9]+)*$/`);

  if (!description) fail("frontmatter.description is required");
  else if (description.length === 0) fail("frontmatter.description is empty");
  else if (description.length > MAX_DESC)
    fail(`frontmatter.description exceeds ${MAX_DESC} chars (${description.length})`);

  if (!metadata || typeof metadata !== "object" || !metadata.version) {
    warn("frontmatter.metadata.version not set — release pipeline will stamp it on first release");
  } else if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(metadata.version)) {
    fail(`frontmatter.metadata.version "${metadata.version}" is not valid semver`);
  }
}

// --- 2. Body length convention ------------------------------------------------------

const body = skillText.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
const bodyLines = body.split(/\r?\n/).length;
if (bodyLines > MAX_BODY_LINES) {
  warn(
    `SKILL.md body is ${bodyLines} lines (>${MAX_BODY_LINES}). Consider moving detail into references/.`
  );
}

// --- 3. Reference path integrity ---------------------------------------------------

const filesToScan = [SKILL_PATH];
if (existsSync(REFERENCES_DIR)) {
  for (const entry of walk(REFERENCES_DIR)) {
    if (entry.endsWith(".md")) filesToScan.push(entry);
  }
}

// Capture file paths, directory paths (trailing /), and globs (containing *).
const PATH_RE = /(?:^|[\s(`'"])((?:\.{0,2}\/)?(?:references|learnings|tools|config|examples|scripts)\/[\w./*-]+)/g;
const FILE_EXT_RE = /\.(md|json|ps1|bat|py|sh|cs|asmdef|unity|prefab)$/i;

function globToRegExp(segment) {
  const esc = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp("^" + esc + "$");
}

// Returns true (resolves), false (dangling), or null (not checkable — skip).
function refResolves(ref) {
  if (ref.includes("*")) {
    // Glob: resolve the literal prefix, then match the single-level wildcard segment.
    const segs = ref.split("/");
    const wildIdx = segs.findIndex((s) => s.includes("*"));
    const baseDir = join(ROOT, ...segs.slice(0, wildIdx));
    if (!existsSync(baseDir)) return false;
    if (wildIdx === segs.length - 1 && !segs[wildIdx].includes("**")) {
      try {
        const re = globToRegExp(segs[wildIdx]);
        return readdirSync(baseDir).some((n) => re.test(n));
      } catch {
        return false;
      }
    }
    return true; // deep/** globs: a present base dir is signal enough
  }
  if (ref.endsWith("/")) {
    const abs = join(ROOT, ref);
    return existsSync(abs) && statSync(abs).isDirectory();
  }
  if (FILE_EXT_RE.test(ref)) return existsSync(join(ROOT, ref));
  return null; // extensionless, non-directory — not a checkable file reference
}

for (const file of filesToScan) {
  const text = readFile(file);
  if (!text) continue;
  for (const match of text.matchAll(PATH_RE)) {
    let ref = match[1].replace(/[.,;:!?)\]]+$/, "");
    if (ref.includes("..") || ref.includes("<") || ref.includes(">")) continue;
    const resolved = refResolves(ref);
    if (resolved === false) {
      const kind = ref.includes("*") ? "glob matches nothing" : ref.endsWith("/") ? "missing directory" : "dangling reference";
      warn(`${relative(ROOT, file)}: ${kind} -> ${ref}`);
    }
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// --- 4. Required top-level layout ----------------------------------------------------

const REQUIRED = ["SKILL.md", "references", "learnings", "tools"];
for (const p of REQUIRED) {
  if (!existsSync(join(ROOT, p))) fail(`Required entry missing at repo root: ${p}`);
}

// --- 5. Learnings sanitization scan -------------------------------------------------
// Generic, client-AGNOSTIC checks. We do NOT denylist one studio's symbols (useless
// the moment a second client arrives). We flag the structural shapes that have no
// legitimate place in a sanitized learning. The primary control is the write-time
// rule in references/learning-sanitization.md; this is the backstop.

const LEARNINGS_DIR = join(ROOT, "learnings");
const POLICY_PATH = join(ROOT, "config", "learning-policy.json");

let policy = { sourceGameAllowlist: [], apiMacroAllowlist: [], denylist: [] };
if (existsSync(POLICY_PATH)) {
  try {
    policy = { ...policy, ...JSON.parse(readFileSync(POLICY_PATH, "utf8")) };
  } catch (e) {
    warn(`config/learning-policy.json unreadable (${e.message}); learnings scan uses empty allowlists`);
  }
}

const allowedSourceGames = new Set(policy.sourceGameAllowlist || []);
const allowedApiMacros = new Set(policy.apiMacroAllowlist || []);
const denyTokens = (policy.denylist || []).filter(Boolean);

// Structural leak signals (no client names hardcoded):
const SOURCE_COORD_RE = /\b([A-Za-z_][\w]*\.(?:cs|cpp|h|hpp|py)):(\d+)/g; // PlayerController.cs:123
const COMMIT_RE = /\bcommit\s+([0-9a-f]{7,40})\b|`([0-9a-f]{7,40})`/g; // commit hashes
const API_MACRO_RE = /\b([A-Z][A-Z0-9]*_API)\b/g; // module-export macros (rare in C#, kept as a backstop)

if (existsSync(LEARNINGS_DIR)) {
  for (const file of walk(LEARNINGS_DIR)) {
    if (!file.endsWith(".md")) continue;
    if (relative(LEARNINGS_DIR, file) === "INDEX.md") continue; // generated, no frontmatter
    const text = readFile(file);
    if (!text) continue;
    const rel = relative(ROOT, file);
    const lfm = parseFrontmatter(text);
    const fmData = lfm ? lfm.data : {};

    // 5a. sourceGame must be an abstract codename (ERROR — a real title is a leak).
    if (allowedSourceGames.size > 0) {
      const sg = fmData.sourceGame;
      if (sg && !allowedSourceGames.has(sg)) {
        fail(`${rel}: sourceGame "${sg}" is not an allowlisted codename (config/learning-policy.json). Real studio/title names are a leak.`);
      }
    }

    // 5b. sanitized attestation (WARN — nudge, doesn't break legacy files).
    if (fmData.sanitized !== "true" && fmData.sanitized !== true) {
      warn(`${rel}: missing "sanitized: true" frontmatter — confirm it was run through references/learning-sanitization.md`);
    }

    // 5c. Configured denylist (ERROR — optional, empty by default).
    for (const tok of denyTokens) {
      if (text.includes(tok)) fail(`${rel}: contains denylisted token "${tok}"`);
    }

    // 5d. Structural leak signals (WARN — some may be intentional Ludeo-SDK refs).
    for (const m of text.matchAll(SOURCE_COORD_RE)) {
      if (/^Ludeo/i.test(m[1])) continue; // SDK source refs are the shared surface — allowed
      warn(`${rel}: source coordinate "${m[0]}" — strip file:line from client source (no transfer value)`);
    }
    if (COMMIT_RE.test(text)) {
      warn(`${rel}: looks like a commit hash reference — strip it (points at a client repo)`);
    }
    for (const m of text.matchAll(API_MACRO_RE)) {
      if (!allowedApiMacros.has(m[1])) {
        warn(`${rel}: module macro "${m[1]}" not in apiMacroAllowlist — likely a client export macro; neutralize it`);
      }
    }
  }
}

// --- 6. Learnings index freshness ----------------------------------------------------
// learnings/INDEX.md powers SKILL.md's Load Learnings step (targeted loading). A stale
// index makes new learnings invisible to integration agents, so staleness is an error.

const INDEX_PATH = join(LEARNINGS_DIR, "INDEX.md");
try {
  const { buildIndex } = await import("./generate-learnings-index.mjs");
  const expected = buildIndex();
  if (!existsSync(INDEX_PATH)) {
    fail("learnings/INDEX.md missing — run: node scripts/generate-learnings-index.mjs");
  } else if (readFileSync(INDEX_PATH, "utf8").replace(/\r\n/g, "\n") !== expected.replace(/\r\n/g, "\n")) {
    fail("learnings/INDEX.md is stale — run: node scripts/generate-learnings-index.mjs");
  }
} catch (e) {
  warn(`learnings index check skipped (${e.message})`);
}

// --- 7. Client-identifier regression guard (hashed denylist) -------------------------
// Catches accidental REINTRODUCTION of real client identifiers (studio / title / class
// prefixes) into shipped content — WITHOUT storing those names in this repo (storing the
// plaintext would itself be the leak). We compare SHA-256 hashes of lowercased tokens.
// Tokenization splits on non-alphanumerics AND camelCase humps, so a reintroduced
// `ClientMechanicController` yields the token `clientmechanic`-parts and is caught. The
// deliberately-generic failure message never echoes the matched token (that would
// re-leak it into CI logs). This hash set is SHARED across the Unity + Unreal skills —
// a client is a client regardless of engine — and the plaintext token list + the
// regenerator live in the maintainer notes (skills/ludeo-unreal/.dev/, untracked).

const FORBIDDEN_TOKEN_HASHES = new Set([
  "04b2b4ea2f66b8e32f47597cf3384b7e81d9b84b28c0fbbaf5587f24b68dbf5e",
  "1842c333d98d2c38226b150038a3a6213b496c673de4f1845184ca684fd34b79",
  "b04d27b7e8c7fb3e2d99ddf7491251eced742678c9bb2329caca4f3bb5708ad8",
  "db3c1d03530ce876b1809ab36183fbf29d21020bcd31901179285aa29d183754",
  "ea69eaf32e87894f99a2fefe9448cef1a95e846c49c451db981002b2512a064d",
  "d15532f99967855af2bcdb07d1346efbf4b4a586aabb3a190e1168108b20b7a0",
  "7d5f4681d7a7d000a2be6df32e18d4706e4fdb109d3ebc90878fd5690e72e520",
  "12aa543802a07baa38c174c17a5f58a35c1251f49ee8d136638ceb393ce405db",
  "9f351645f7f76c4bb7eda4354cc316eb0367bc44331510a4eca5a7f087154d8f",
  "e3c72a1f798fc7b544fd1f930d5d72e37919a0d0a4d9c00c8a4c07077de65af2",
  "e74a03b075bad74d7c48e5706e9027154c003aa6dc160ed33ac2da01789f7db2",
  "823e291431cff346861d254b6919a7f81aae326620bcab48baf225b77521cfc8",
  "c921e8aabfa279482bb737530a96d20ab8f7ec186fe4f26ea1522c418e94d0cb",
  "6c8d4a2c6cde265e4affbcd67d40d0708318db75952239f7fd14142580ac10f4",
  "d68ebe3c27c836bfffddcc8045cc7a464f006f1c05167f3a8fbc9ef089664c5e",
  "55af050c759283dbb7652dcbc462930c314a82a9c8fc654a65a110dea224043e",
  "3568edca25022faa7a63d2517c68b73a8427b4e26062e2c05fd2440e50069da1",
  "fe824cc2957a6922da8de405341322a778d62ffb18098c5a4bac02a088867cf5",
  "61801799f956fdd5d906338b62b8b187c765fcaac27be18104295247e22aa9ce",
  "b5decf9557716b50759e0931e365184f34dd7fe24d5650cb79717865877368b6",
  "b8de475a45e6d0158f45c9c3f53bf32f09fbebeb55344f5ae336446c7dc84695",
]);

const GUARD_DIRS = ["references", "learnings", "config", "tools"];
const GUARD_TEXT_EXT = /\.(md|json|ps1|bat|py|sh|txt|cs|asmdef)$/i;

function tokenizeForGuard(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

const guardFiles = [SKILL_PATH];
for (const d of GUARD_DIRS) {
  const dir = join(ROOT, d);
  if (existsSync(dir)) for (const f of walk(dir)) if (GUARD_TEXT_EXT.test(f)) guardFiles.push(f);
}
for (const rootFile of ["README.md", "CHANGELOG.md"]) {
  const p = join(ROOT, rootFile);
  if (existsSync(p)) guardFiles.push(p);
}
for (const file of guardFiles) {
  const text = readFile(file);
  if (text === null) continue;
  for (const tok of tokenizeForGuard(text)) {
    if (FORBIDDEN_TOKEN_HASHES.has(createHash("sha256").update(tok).digest("hex"))) {
      fail(`${relative(ROOT, file)}: contains a client-identifier token that must be sanitized (hashed-denylist match). Re-run the sanitization pass (see references/learning-sanitization.md).`);
      break; // one error per file is enough; don't echo the token
    }
  }
}

// --- 8. Report -----------------------------------------------------------------------

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(
  `\nSKILL.md: ${errors.length} error(s), ${warnings.length} warning(s), ${bodyLines} body lines`
);

process.exit(errors.length > 0 ? 1 : 0);
