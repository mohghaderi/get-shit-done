/**
 * GSD Tools Tests - Init
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function toPosix(p) {
  return p ? p.replace(/\\/g, '/') : p;
}

describe('init commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(toPosix(output.context_path), '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(toPosix(output.research_path), '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(toPosix(output.verification_path), '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(toPosix(output.uat_path), '.planning/phases/03-api/03-UAT.md');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init new-paper returns paper context', () => {
    const result = runGsdTools('init new-paper', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paper_root, 'paper');
    assert.strictEqual(output.paper_path, 'paper/PAPER.md');
    assert.strictEqual(output.sections_dir, 'paper/sections');
    assert.strictEqual(output.source_log_path, 'paper/sources/SOURCE-LOG.md');
    assert.strictEqual(output.image_log_path, 'paper/images/IMAGE-SOURCES.md');
    assert.strictEqual(output.protocol_path, 'paper/methodology/PROTOCOL.md');
    assert.strictEqual(output.reproducibility_path, 'paper/reproducibility/REPRODUCIBILITY.md');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init phase-op 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(toPosix(output.context_path), '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(toPosix(output.research_path), '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(toPosix(output.verification_path), '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(toPosix(output.uat_path), '.planning/phases/03-api/03-UAT.md');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────

