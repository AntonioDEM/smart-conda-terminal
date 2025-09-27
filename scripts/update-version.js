#!/usr/bin/env node

/**
 * Smart Conda Terminal - Version Update Script
 * Automatically updates version in package.json and CHANGELOG.md
 * Usage: node scripts/update-version.js [major|minor|patch] [--dry-run] [--no-git]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
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

// Simple version increment (basic implementation)
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

  // Check if we're in the right directory
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    error(`package.json not found at ${PACKAGE_JSON_PATH}. Are you in the right directory?`);
  }

  // Check if git is available and we're in a git repository
  try {
    execSync('git --version', { stdio: 'ignore' });
    const gitDir = execSync('git rev-parse --git-dir', { 
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim();
    success(`Git repository: ${gitDir}`);
  } catch (e) {
    warning('Git is not available or this is not a git repository');
  }

  success('Environment validation passed');
}

// Read and parse package.json
function readPackageJson() {
  try {
    const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    error(`Failed to read package.json: ${e.message}`);
  }
}

// Write package.json with pretty formatting
function writePackageJson(packageData) {
  try {
    const content = JSON.stringify(packageData, null, 2) + '\n';
    fs.writeFileSync(PACKAGE_JSON_PATH, content, 'utf8');
    success(`Updated package.json to version ${packageData.version}`);
  } catch (e) {
    error(`Failed to write package.json: ${e.message}`);
  }
}

// Update or create CHANGELOG.md
function updateChangelog(newVersion, oldVersion) {
  const changelogTemplate = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [${newVersion}] - ${new Date().toISOString().split('T')[0]}

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements

`;

  let changelogContent = changelogTemplate;

  // If CHANGELOG.md already exists, insert new version at the top
  if (fs.existsSync(CHANGELOG_PATH)) {
    const existingChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    changelogContent = changelogTemplate + '\n' + existingChangelog;
  }

  fs.writeFileSync(CHANGELOG_PATH, changelogContent, 'utf8');
  success(`Updated CHANGELOG.md with version ${newVersion}`);
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

  // Read current package.json
  const packageData = readPackageJson();
  const currentVersion = packageData.version || '0.0.0';

  // Calculate new version
  const newVersion = incrementVersion(currentVersion, versionType);

  // Display version information
  info(`Current version: ${currentVersion}`);
  info(`New version: ${newVersion} (${versionType})`);

  if (dryRun) {
    info('Files that would be updated:');
    info('- package.json');
    info('- CHANGELOG.md');
    info(`Git tag that would be created: v${newVersion}`);
    return;
  }

  // Update package.json
  packageData.version = newVersion;
  writePackageJson(packageData);

  // Update CHANGELOG.md
  updateChangelog(newVersion, currentVersion);

  // Git operations (if not disabled)
  if (!noGit) {
    try {
      execSync('git add package.json CHANGELOG.md', { cwd: PROJECT_ROOT });
      execSync(`git commit -m "Bump version to ${newVersion}"`, { cwd: PROJECT_ROOT });
      execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`, { cwd: PROJECT_ROOT });
      success(`Git tag v${newVersion} created and committed`);
    } catch (e) {
      warning('Git operations skipped or failed');
    }
  }

  success(`Version successfully updated from ${currentVersion} to ${newVersion}`);
}

// Run the script
if (require.main === module) {
  main();
}
