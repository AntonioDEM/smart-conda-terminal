const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getOsLabel, inferEnvNameFromWorkspace } = require('./modules/env');

let channel = null;

function getOutputChannel() {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Smart Conda Logs');
  }
  return channel;
}

function logInfo(message) {
  try {
    getOutputChannel().appendLine(`[INFO] ${message}`);
  } catch (e) {
    // noop
  }
  try { console.log(message); } catch (_) {}
}

function logError(message) {
  try {
    getOutputChannel().appendLine(`[ERROR] ${message}`);
  } catch (e) {
    // noop
  }
  try { console.error(message); } catch (_) {}
}

function ensureFile(filePath, headerText) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, headerText || '', { encoding: 'utf8' });
  }
}

function appendStructureLog(workspaceFolder, updateReason) {
  try {
    const filePath = path.join(workspaceFolder, 'STRUTTURA_PROGETTO.md');
    ensureFile(filePath, '# Struttura del Progetto\n\n');
    const ts = new Date().toISOString();
    const block = `\n### Aggiornamento – ${ts}\n- ${updateReason}\n`;
    fs.appendFileSync(filePath, block, { encoding: 'utf8' });
    logInfo(`Append in STRUTTURA_PROGETTO.md: OK (${filePath})`);
  } catch (err) {
    logError(`Append in STRUTTURA_PROGETTO.md: ERROR – ${err?.message || err}`);
  }
}

function appendReadmeLog(readmeFilePath, updateReason) {
  try {
    ensureFile(readmeFilePath, '# README\n\n');
    const ts = new Date().toISOString();
    const block = `\n### Aggiornamento – ${ts}\n- ${updateReason}\n`;
    fs.appendFileSync(readmeFilePath, block, { encoding: 'utf8' });
    logInfo(`Append in README: OK (${readmeFilePath})`);
  } catch (err) {
    logError(`Append in README: ERROR – ${err?.message || err}`);
  }
}

function findReadmeFiles(rootPath, depth = 2) {
  const results = [];
  const queue = [{ p: rootPath, d: 0 }];
  const ignore = new Set(['node_modules', '.git', 'dist', 'out']);

  while (queue.length) {
    const { p, d } = queue.shift();
    if (d > depth) continue;
    let entries = [];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        if (!ignore.has(e.name)) queue.push({ p: full, d: d + 1 });
      } else if (e.isFile()) {
        const nameLower = e.name.toLowerCase();
        if (nameLower === 'readme.md' || nameLower === 'readme') {
          results.push(full);
        }
      }
    }
  }
  return results;
}

// getOsLabel & inferEnvNameFromWorkspace importati da modules/env

module.exports = {
  getOutputChannel,
  logInfo,
  logError,
  appendStructureLog,
  appendReadmeLog,
  findReadmeFiles,
  getOsLabel,
  inferEnvNameFromWorkspace,
};