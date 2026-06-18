#!/usr/bin/env node
// Generates learnings/INDEX.md — one line per learning: path | tier | phase | hook.
// The hook is the frontmatter `question` (the precondition trigger) when present,
// else the file's H1 title. SKILL.md Step 3 loads this index first and uses it to
// decide which learning bodies to read, instead of reading all ~250 files per stage.
//
// Run after adding/renaming any learning:  node scripts/generate-learnings-index.mjs
// validate-skill.mjs fails when the index is stale.
//
// Zero npm dependencies so it runs everywhere.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEARNINGS_DIR = join(ROOT, "learnings");
const INDEX_PATH = join(LEARNINGS_DIR, "INDEX.md");
const MAX_HOOK = 220;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseLearning(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  if (match) {
    for (const raw of match[1].split(/\r?\n/)) {
      const m = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m) data[m[1]] = unquote(m[2]);
    }
  }
  const body = match ? text.slice(match[0].length) : text;
  const h1 = body.match(/^#\s+(.+)$/m);
  data._title = h1 ? h1[1].trim() : "";
  return data;
}

export function buildIndex() {
  const rows = [];
  for (const file of walk(LEARNINGS_DIR)) {
    if (!file.endsWith(".md")) continue;
    if (resolve(file) === resolve(INDEX_PATH)) continue;
    const rel = relative(LEARNINGS_DIR, file).replace(/\\/g, "/");
    const fm = parseLearning(readFileSync(file, "utf8"));
    const tier = fm.tier || "?";
    const hasPhase = fm.phase !== undefined;
    const phase = hasPhase ? fm.phase : (fm.stage ?? "?");
    let hook = fm.question && fm.question !== "null" ? fm.question : fm._title;
    hook = hook.replace(/\s+/g, " ").trim();
    if (hook.length > MAX_HOOK) hook = hook.slice(0, MAX_HOOK - 1) + "…";
    rows.push({ rel, tier, phase, hasPhase, hook });
  }
  rows.sort((a, b) => a.rel.localeCompare(b.rel));

  const lines = [
    "# Learnings Index (generated — do not edit by hand)",
    "",
    "One line per learning: `path | tier | phase | hook`. The hook is the precondition",
    "question when the learning has one, else its title. This index is a **pointer, not",
    "the lesson** — never cite or apply a learning from its index line alone; read the body.",
    "",
    "Regenerate with `node scripts/generate-learnings-index.mjs` after adding a learning.",
    "If you add a learning where you cannot run node (e.g. an installed skill copy),",
    "append the line by hand in the same format.",
    "",
    `Total: ${rows.length}`,
    "",
    ...rows.map((r) => `- ${r.rel} | ${r.tier} | ${r.hasPhase ? "p" : "s"}${r.phase} | ${r.hook}`),
    "",
  ];
  return lines.join("\n");
}

const content = buildIndex();
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  writeFileSync(INDEX_PATH, content, "utf8");
  console.log(`Wrote ${relative(ROOT, INDEX_PATH)} (${content.split("\n").length} lines)`);
}
