#!/usr/bin/env node

/**
 * Smart Conda Terminal - Version Update Script (Complete)
 * Automatically updates version in package.json, environment.yml, pyproject.toml, and CHANGELOG.md
 * Usage: node scripts/update-version.js [major|minor|patch] [--dry-run] [--no-git]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const VSCODE_EXTENSION_PACKAGE = path.join(PROJECT_ROOT, 'vscode-extension', 'package.json');
const PYPROJECT_PATH = path.join(PROJECT_ROOT, 'pyproject.toml');
const ENVIRONMENT_PATH = path.join(PROJECT_ROOT, 'environment.yml');
const CHANGELOG_PATH = path.join(PROJECT_ROOT, 'CHANGELOG.md');

// Color console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Simple version increment
function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    error(`Invalid version format: ${version}. Expected format: x.y.z`);
  }

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const versionType = args.find(arg => ['major', 'minor', 'patch'].includes(arg)) || 'patch';
  const dryRun = args.includes('--dry-run');
  const noGit = args.includes('--no-git');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Smart Conda Terminal - Version Update Script

Usage: node scripts/update-version.js [major|minor|patch] [options]

Options:
  major           Increment major version (x.0.0)
  minor           Increment minor version (0.x.0)
  patch           Increment patch version (0.0.x) [default]
  --dry-run       Show what would be changed without making changes
  --no-git        Skip git operations (tag creation and commit)
  --help, -h      Show this help message

Examples:
  node scripts/update-version.js patch
  node scripts/update-version.js minor --dry-run
  node scripts/update-version.js major --no-git
`);
    process.exit(0);
  }

  return { versionType, dryRun, noGit };
}

// Validate environment and prerequisites
function validateEnvironment() {
  info('🔍 Validating environment...');

  // Check if we have at least one version file
  const hasPackageJson = fs.existsSync(PACKAGE_JSON_PATH);
  const hasPyproject = fs.existsSync(PYPROJECT_PATH);
  const hasEnvironment = fs.existsSync(ENVIRONMENT_PATH);

  if (!hasPackageJson && !hasPyproject && !hasEnvironment) {
    error('No package.json, pyproject.toml, or environment.yml found. Are you in the right directory?');
  }

  // Check git status for uncommitted changes
  try {
    execSync('git --version', { stdio: 'ignore' });
    const gitStatus = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim();

    if (gitStatus) {
      warning('You have uncommitted changes:');
      console.log(gitStatus);
      warning('Consider committing your changes before updating version');
    }

    success('Git repository found');
  } catch (e) {
    warning('Git is not available or this is not a git repository');
  }

  success('Environment validation passed');
}

// Read current version from available files
function getCurrentVersion() {
  let version = '0.0.0';

  // Try package.json first
  if (fs.existsSync(PACKAGE_JSON_PATH)) {
    try {
      const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
      if (packageData.version) {
        version = packageData.version;
        info(`Found version ${version} in package.json`);
        return { version, source: 'package.json' };
      }
    } catch (e) {
      warning('Failed to read package.json');
    }
  }

  // Try pyproject.toml
  if (fs.existsSync(PYPROJECT_PATH)) {
    try {
      const content = fs.readFileSync(PYPROJECT_PATH, 'utf8');
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      if (versionMatch) {
        version = versionMatch[1];
        info(`Found version ${version} in pyproject.toml`);
        return { version, source: 'pyproject.toml' };
      }
    } catch (e) {
      warning('Failed to read pyproject.toml');
    }
  }

  // Try environment.yml
  if (fs.existsSync(ENVIRONMENT_PATH)) {
    try {
      const content = fs.readFileSync(ENVIRONMENT_PATH, 'utf8');
      const versionMatch = content.match(/version:\s*([^\s\n]+)/);
      if (versionMatch) {
        version = versionMatch[1];
        info(`Found version ${version} in environment.yml`);
        return { version, source: 'environment.yml' };
      }
    } catch (e) {
      warning('Failed to read environment.yml');
    }
  }

  return { version, source: null };
}

// Update package.json
function updatePackageJson(newVersion) {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) return;

  try {
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    packageData.version = newVersion;
    const content = JSON.stringify(packageData, null, 2) + '\n';
    fs.writeFileSync(PACKAGE_JSON_PATH, content, 'utf8');
    success(`Updated package.json to version ${newVersion}`);
  } catch (e) {
    error(`Failed to update package.json: ${e.message}`);
  }
}

// Update VS Code extension package.json
function updateVSCodeExtension(newVersion) {
  if (!fs.existsSync(VSCODE_EXTENSION_PACKAGE)) return;

  try {
    const packageData = JSON.parse(fs.readFileSync(VSCODE_EXTENSION_PACKAGE, 'utf8'));
    packageData.version = newVersion;
    const content = JSON.stringify(packageData, null, 2) + '\n';
    fs.writeFileSync(VSCODE_EXTENSION_PACKAGE, content, 'utf8');
    success(`Updated vscode-extension/package.json to version ${newVersion}`);
  } catch (e) {
    warning(`Failed to update vscode-extension/package.json: ${e.message}`);
  }
}

// Update pyproject.toml
function updatePyproject(newVersion) {
  if (!fs.existsSync(PYPROJECT_PATH)) return;

  try {
    let content = fs.readFileSync(PYPROJECT_PATH, 'utf8');
    content = content.replace(
      /version\s*=\s*["'][^"']+["']/,
      `version = "${newVersion}"`
    );
    fs.writeFileSync(PYPROJECT_PATH, content, 'utf8');
    success(`Updated pyproject.toml to version ${newVersion}`);
  } catch (e) {
    error(`Failed to update pyproject.toml: ${e.message}`);
  }
}

// Update environment.yml
function updateEnvironment(newVersion) {
  if (!fs.existsSync(ENVIRONMENT_PATH)) return;

  try {
    let content = fs.readFileSync(ENVIRONMENT_PATH, 'utf8');
    content = content.replace(
      /version:\s*[^\s\n]+/,
      `version: ${newVersion}`
    );
    fs.writeFileSync(ENVIRONMENT_PATH, content, 'utf8');
    success(`Updated environment.yml to version ${newVersion}`);
  } catch (e) {
    error(`Failed to update environment.yml: ${e.message}`);
  }
}

// Update or create CHANGELOG.md (FIXED - no duplicates)
function updateChangelog(newVersion, oldVersion) {
  const newEntry = `## [${newVersion}] - ${new Date().toISOString().split('T')[0]}

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements

`;

  if (fs.existsSync(CHANGELOG_PATH)) {
    // Read existing changelog
    const existingContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');

    // Find where to insert new version (after first heading but before any existing versions)
    const lines = existingContent.split('\n');
    let insertIndex = -1;

    // Look for first ## [version] entry
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^## \[[\d.]+\]/)) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex !== -1) {
      // Insert before existing versions
      lines.splice(insertIndex, 0, newEntry);
      const newContent = lines.join('\n');
      fs.writeFileSync(CHANGELOG_PATH, newContent, 'utf8');
    } else {
      // No existing versions found, append after header
      const headerEndIndex = lines.findIndex((line, idx) => line.trim() === '' && idx > 5) || 10;
      lines.splice(headerEndIndex + 1, 0, newEntry);
      const newContent = lines.join('\n');
      fs.writeFileSync(CHANGELOG_PATH, newContent, 'utf8');
    }
  } else {
    // Create new changelog
    const changelogTemplate = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

${newEntry}`;

    fs.writeFileSync(CHANGELOG_PATH, changelogTemplate, 'utf8');
  }

  success(`Updated CHANGELOG.md with version ${newVersion}`);
}
function regeneratePackageLock() {
  try {
    // Rigenera il lock file nella root
    info('Regenerating package-lock.json in root...');
    execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    success('Regenerated package-lock.json in root');

    // Rigenera il lock file in vscode-extension
    const vscodeExtensionPath = path.join(PROJECT_ROOT, 'vscode-extension');
    if (fs.existsSync(path.join(vscodeExtensionPath, 'package.json'))) {
      info('Regenerating package-lock.json in vscode-extension...');
      // Cancella il vecchio e ricrea
      const lockPath = path.join(vscodeExtensionPath, 'package-lock.json');
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
      execSync('npm install', { cwd: vscodeExtensionPath, stdio: 'pipe' });
      success('Regenerated package-lock.json in vscode-extension');
    }
  } catch (e) {
    warning(`Package-lock.json regeneration encountered issues: ${e.message}`);
  }
}
// Main function
function main() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════╗
║     Smart Conda Terminal              ║
║     Version Update Script             ║
╚═══════════════════════════════════════╝${colors.reset}
`);

  const { versionType, dryRun, noGit } = parseArgs();

  if (dryRun) {
    warning('DRY RUN MODE - No changes will be made');
  }

  // Validate environment
  validateEnvironment();

  // Get current version
  const { version: currentVersion, source } = getCurrentVersion();

  if (!source) {
    warning('No version found in any file, using default 0.0.0');
  }

  // Calculate new version
  const newVersion = incrementVersion(currentVersion, versionType);

  // Display version information
  info(`Current version: ${currentVersion}${source ? ` (from ${source})` : ''}`);
  info(`New version: ${newVersion} (${versionType})`);

  if (dryRun) {
    info('Files that would be updated:');
    if (fs.existsSync(PACKAGE_JSON_PATH)) info('- package.json');
    if (fs.existsSync(VSCODE_EXTENSION_PACKAGE)) info('- vscode-extension/package.json');
    if (fs.existsSync(PYPROJECT_PATH)) info('- pyproject.toml');
    if (fs.existsSync(ENVIRONMENT_PATH)) info('- environment.yml');
    info('- CHANGELOG.md');
    if (!noGit) info(`Git tag that would be created: v${newVersion}`);
    return;
  }

  // Update all version files
  updatePackageJson(newVersion);
  updateVSCodeExtension(newVersion);
  regeneratePackageLock()
  updatePyproject(newVersion);
  updateEnvironment(newVersion);
  updateChangelog(newVersion, currentVersion);

  // Git operations (if not disabled)
  if (!noGit) {
    try {
      const filesToAdd = ['CHANGELOG.md'];
      if (fs.existsSync(PACKAGE_JSON_PATH)) filesToAdd.push('package.json');
      if (fs.existsSync(VSCODE_EXTENSION_PACKAGE)) filesToAdd.push('vscode-extension/package.json');
      if (fs.existsSync(PYPROJECT_PATH)) filesToAdd.push('pyproject.toml');
      if (fs.existsSync(ENVIRONMENT_PATH)) filesToAdd.push('environment.yml');

      execSync(`git add ${filesToAdd.join(' ')}`, { cwd: PROJECT_ROOT });
      execSync(`git commit -m "Bump version to ${newVersion}"`, { cwd: PROJECT_ROOT });
      execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`, { cwd: PROJECT_ROOT });
      success(`Git tag v${newVersion} created and committed`);
    } catch (e) {
      warning(`Git operations failed: ${e.message}`);
    }
  }

  success(`Version successfully updated from ${currentVersion} to ${newVersion}`);
}

// Run the script
if (require.main === module) {
  main();
}