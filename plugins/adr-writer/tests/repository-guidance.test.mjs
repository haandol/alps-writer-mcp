import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PLUGIN_ROOT } from "./helpers.mjs";

const REPO_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");

function read(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("README and AGENTS lead with reproducible conditions rather than recoverable facts", () => {
  const readme = read("README.md");
  const agents = read("AGENTS.md");

  for (const source of [readme, agents]) {
    assert.match(source, /preserve (?:reproducible )?conditions/i);
    assert.match(source, /recoverable facts/i);
    assert.match(source, /Requirement gate/i);
    assert.match(source, /Code-readthrough test/i);
    assert.match(source, /ADR admission gate and litmus test/i);
    assert.match(
      source,
      /does not mean recreating the same|behavior and constraints, not identical code/is,
    );
    assert.match(source, /Issue\s*[/|,]\s*PR\s*[/|,]\s*commit/i);
  }
});

test("repository guidance and CI agree on the Node 24 runtime", () => {
  const agents = read("AGENTS.md");
  const workflow = read(".github/workflows/ci.yaml");

  assert.doesNotMatch(agents, /node 20\/22/i);
  assert.match(agents, /Node 24 test\/build\/runtime jobs/i);
  assert.equal(
    [...workflow.matchAll(/node-version:\s*"([^"]+)"/g)].every((match) => match[1] === "24"),
    true,
  );
});
