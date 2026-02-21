/**
 * GPD Tools Test Helpers
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS_PATH = path.join(__dirname, '..', 'get-paper-done', 'bin', 'gpd-tools.cjs');

// Helper to run gpd-tools command
function runGpdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gpd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

module.exports = { runGpdTools, createTempProject, cleanup, TOOLS_PATH };
