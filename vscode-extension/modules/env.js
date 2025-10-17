const fs = require('fs');
const path = require('path');

function getOsLabel() {
  const platform = process.platform;
  if (platform === 'win32') return 'Windows';
  if (platform === 'darwin') return 'macOS';
  return 'Linux';
}

function inferEnvNameFromWorkspace(workspaceFolder) {
  // 1) Prefer environment.yml if present
  try {
    const envYaml = path.join(workspaceFolder, 'environment.yml');
    if (fs.existsSync(envYaml)) {
      const content = fs.readFileSync(envYaml, 'utf8');
      const m = content.match(/name\s*:\s*([\w-]+)/i);
      if (m && m[1]) return m[1];
    }
  } catch (_) {}

  // 2) Fallback: infer from workspace .code-workspace (python.defaultInterpreterPath)
  try {
    const wsFile = path.join(workspaceFolder, `${path.basename(workspaceFolder)}.code-workspace`);
    if (!fs.existsSync(wsFile)) return 'unknown';
    const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
    const py = ws.settings && ws.settings['python.defaultInterpreterPath'];
    if (!py || typeof py !== 'string') return 'unknown';
    // Windows/Unix patterns
    let m = py.match(/envs\/([^\\]+)\\python\.exe/i);
    if (m && m[1]) return m[1];
    m = py.match(/envs\/([^/]+)\/python\.exe/i);
    if (m && m[1]) return m[1];
    m = py.match(/envs\/([^/]+)\/bin\/python/i);
    if (m && m[1]) return m[1];
    m = py.match(/envs\/([^\\]+)\\bin\\python/i);
    if (m && m[1]) return m[1];
    // base env heuristic
    if (/miniconda|anaconda/i.test(py) && /(bin\/python|python\.exe)/i.test(py)) return 'base';
    return 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

module.exports = {
  getOsLabel,
  inferEnvNameFromWorkspace,
};