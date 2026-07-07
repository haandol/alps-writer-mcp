// Shared helpers for adr-writer tests. No external deps — Node's built-in
// test runner + child_process only. Each test builds a throwaway fixture
// repo under os.tmpdir() so runs are hermetic and parallel-safe.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(HERE, "..");
export const INVARIANTS = path.join(PLUGIN_ROOT, "scripts", "adr-invariants.sh");
export const HOOK = path.join(PLUGIN_ROOT, "hooks", "surface-adr-context.mjs");
export const TEMPLATES = path.join(PLUGIN_ROOT, "templates", "adr");
export const STRUCTURE_LINT = path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs");

// Make a fresh temp dir; caller removes it (or use withTmp).
export function mkTmp(prefix = "adr-test-") {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function withTmp(fn) {
  const dir = mkTmp();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function write(dir, rel, content) {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

export function git(dir, args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

export function initRepo(dir) {
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "t@t.co"]);
  git(dir, ["config", "user.name", "t"]);
}

export function commitAll(dir, msg = "init") {
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", msg]);
}

// Run adr-invariants.sh in `dir`. Returns {code, stdout}. Never throws on a
// non-zero exit (exit 1 = violations found is an expected outcome we assert on).
// `env` merges over process.env — used to inject a stub PATH (fail-closed test).
export function runInvariants(dir, extraArgs = [], env = {}) {
  try {
    const stdout = execFileSync("bash", [INVARIANTS, ...extraArgs], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? -1, stdout: (e.stdout || "") + (e.stderr || "") };
  }
}

// Run adr-structure-lint.mjs in `dir`. Returns {code, stdout}. --json is added
// by default so tests can parse findings; pass raw=true for the text report.
export function runStructureLint(dir, extraArgs = [], { json = true } = {}) {
  const args = [STRUCTURE_LINT, ...extraArgs];
  if (json && !extraArgs.includes("--json")) args.push("--json");
  try {
    const stdout = execFileSync("node", args, { cwd: dir, encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? -1, stdout: (e.stdout || "") + (e.stderr || "") };
  }
}

// Run the UserPromptSubmit hook against a fixture and return the parsed
// additionalContext string (or the whole JSON when raw=true).
export function runHook(dir, { raw = false, env = {} } = {}) {
  const out = execFileSync("node", [HOOK], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
    input: "{}",
    encoding: "utf8",
  });
  const parsed = JSON.parse(out);
  if (raw) return parsed;
  return parsed.hookSpecificOutput?.additionalContext ?? "";
}
