const fs = require('fs');
const path = require('path');

function getCurrentVersion(workspaceFolder) {
  try {
    const packageJsonPath = path.join(workspaceFolder, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '0.0.0';
    }

    const pyprojectPath = path.join(workspaceFolder, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
      const versionMatch = pyproject.match(/version\s*=\s*["']([^"']+)["']/);
      if (versionMatch) return versionMatch[1];
    }
  } catch (error) {
    console.error('Failed to get current version:', error);
  }

  return '0.0.0';
}

function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2] += 1;
  }

  return parts.join('.');
}

module.exports = {
  getCurrentVersion,
  incrementVersion
};