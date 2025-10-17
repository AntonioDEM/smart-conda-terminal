const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const logging = require('./logging');
const { getOutputChannel, logInfo, logError } = logging;
const { getOsLabel, inferEnvNameFromWorkspace } = require('./modules/env');
const { generateWorkspaceConfig } = require('./modules/workspace');
const { configureShellAutoActivation } = require('./modules/shell');
const { getCurrentVersion, incrementVersion } = require('./modules/version');

let templates = {};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    try {
        const channel = getOutputChannel();
        if (channel) context.subscriptions.push(channel);
    } catch (_) {}
    logInfo('Smart Conda Workspace extension activated');

    // Rimosso: gestione context key per visibilità Explorer (ora la view è sempre presente in Explorer con workspace aperto)

    // Load templates
    try {
        const templatesPath = path.join(__dirname, 'templates.json');
        templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    } catch (error) {
        console.error('Failed to load templates:', error);
    }

    // Register commands
    const configureWorkspace = vscode.commands.registerCommand('smartCondaWorkspace.configureWorkspace', configureWorkspaceCommand);
    const updateVersion = vscode.commands.registerCommand('smartCondaWorkspace.updateVersion', updateVersionCommand);
    const logUpdate = vscode.commands.registerCommand('smartCondaWorkspace.logUpdate', logUpdateCommand);
    const createRequirements = vscode.commands.registerCommand('smartCondaWorkspace.createRequirements', createRequirementsCommand);
    const createEnvironment = vscode.commands.registerCommand('smartCondaWorkspace.createEnvironment', createEnvironmentCommand);
    const exportEnvironmentYml = vscode.commands.registerCommand('smartCondaWorkspace.exportEnvironmentYml', exportEnvironmentYmlCommand);

    context.subscriptions.push(configureWorkspace, updateVersion, logUpdate, createRequirements, createEnvironment, exportEnvironmentYml);

    try {
        const provider = new SmartCondaProvider();
        const explorerTree = vscode.window.createTreeView('smartCondaView', { treeDataProvider: provider });
        const activityTree = vscode.window.createTreeView('smartCondaViewActivity', { treeDataProvider: provider });
        context.subscriptions.push(explorerTree, activityTree);
    } catch (_) {}
}

async function configureWorkspaceCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        // Detect project type
        const projectType = await detectProjectType(workspaceFolder);

        // Get available conda environments
        const availableEnvs = await getCondaEnvironments();

        // Show environment selection
        const selectedEnv = await vscode.window.showQuickPick(
            availableEnvs.map(env => ({
                label: env.name,
                description: env.path,
                detail: `Python: ${env.python_version || 'Unknown'}`,
                env: env
            })),
            {
                placeHolder: 'Select conda environment for this workspace:'
            }
        );

        if (!selectedEnv) return;

        // Show project type selection
        const selectedType = await vscode.window.showQuickPick([
            { label: 'Python', description: 'Python project with conda' },
            { label: 'Node.js', description: 'Node.js project with conda' },
            { label: 'Mixed', description: 'Python + Node.js project' }
        ], {
            placeHolder: `Detected: ${projectType}. Select project type:`
        });

        if (!selectedType) return;

        // Generate workspace configuration
        const workspaceConfig = generateWorkspaceConfig(workspaceFolder, selectedEnv.env, selectedType.label.toLowerCase(), templates);

        // Write workspace file
        const workspaceFile = path.join(workspaceFolder, `${path.basename(workspaceFolder)}.code-workspace`);
        fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

        // Configure shell auto-activation
        await configureShellAutoActivation(workspaceFolder, selectedEnv.env);

        // Apply settings in current workspace and open activated terminal (no reopen)
        await applySettingsAndActivateTerminal(workspaceFolder, selectedEnv.env);

        // Offline reminder: append a dated entry to STRUTTURA_PROGETTO.md
        const osLabel = process.platform === 'win32' ? 'Windows' : (process.platform === 'darwin' ? 'macOS' : 'Linux');
        appendStructureLog(
            workspaceFolder,
            `Workspace configurato per ambiente '${selectedEnv.env.name}' su ${osLabel}; profili terminale con messaggio unico (Python; Node; npm se presenti).`
        );

        // Show success message with option to reload or open workspace file
        const action = await vscode.window.showInformationMessage(
            `Workspace configured for ${selectedType.label} with env '${selectedEnv.env.name}'. A new terminal is ready with the env activated.`,
            'Reload Window', 'Open Workspace File'
        );

        if (action === 'Reload Window') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else if (action === 'Open Workspace File') {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFile), { forceNewWindow: false });
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Configuration failed: ${error.message}`);
    }
}

// Apply settings immediately and create a terminal with the selected env activated
async function applySettingsAndActivateTerminal(workspaceFolder, condaEnv) {
    try {
        const config = vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration() : null;
        if (config) {
            await config.update('python.defaultInterpreterPath', condaEnv.python, vscode.ConfigurationTarget.Workspace);
            await config.update('python.condaPath', condaEnv.conda, vscode.ConfigurationTarget.Workspace);
            await config.update('python.terminal.activateEnvironment', true, vscode.ConfigurationTarget.Workspace);

            const isWin = process.platform === 'win32';
            if (isWin) {
                const profiles = config.get('terminal.integrated.profiles.windows') || {};
                profiles['conda-env'] = {
                    path: 'C\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
                    args: ['-NoExit', '-Command', `conda activate ${condaEnv.name}`],
                    icon: 'terminal-powershell'
                };
                await config.update('terminal.integrated.profiles.windows', profiles, vscode.ConfigurationTarget.Workspace);
                await config.update('terminal.integrated.defaultProfile.windows', 'conda-env', vscode.ConfigurationTarget.Workspace);
            } else {
                const shellPath = process.env.SHELL || '/bin/bash';
                const profilesKey = process.platform === 'darwin' ? 'terminal.integrated.profiles.osx' : 'terminal.integrated.profiles.linux';
                const defaultKey = process.platform === 'darwin' ? 'terminal.integrated.defaultProfile.osx' : 'terminal.integrated.defaultProfile.linux';
                const profiles = config.get(profilesKey) || {};
                // Attempt to source conda.sh then activate
                const base = (() => { try { return execSync('conda info --base', { encoding: 'utf8' }).trim(); } catch { return ''; } })();
                const activateSnippet = base ? `source \"${base}/etc/profile.d/conda.sh\" && conda activate ${condaEnv.name}` : `conda activate ${condaEnv.name}`;
                profiles['conda-env'] = { path: shellPath, args: ['-l', '-c', `${activateSnippet}; ${shellPath} -l`] };
                await config.update(profilesKey, profiles, vscode.ConfigurationTarget.Workspace);
                await config.update(defaultKey, 'conda-env', vscode.ConfigurationTarget.Workspace);
            }
        }

        // Create a new terminal and activate env immediately
        const term = vscode.window.createTerminal(`Conda: ${condaEnv.name}`);
        const base = (() => { try { return execSync('conda info --base', { encoding: 'utf8' }).trim(); } catch { return ''; } })();
        const isWin = process.platform === 'win32';
        if (isWin) {
            term.sendText(`conda activate ${condaEnv.name}`);
        } else {
            if (base) {
                term.sendText(`source \"${base}/etc/profile.d/conda.sh\" || true; conda activate ${condaEnv.name}`);
            } else {
                term.sendText(`conda activate ${condaEnv.name}`);
            }
        }
        term.show();
    } catch (e) {
        // Non-bloccante: se fallisce, almeno i settings sono aggiornati
        try { vscode.window.showWarningMessage(`Immediate activation failed: ${e.message}`); } catch (_) {}
    }
}
async function updateVersionCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        // Check if update-version.js exists
        const scriptPath = path.join(workspaceFolder, 'scripts', 'update-version.js');
        if (!fs.existsSync(scriptPath)) {
            vscode.window.showErrorMessage('update-version.js script not found in scripts/ directory');
            return;
        }

        // Get current version
        const currentVersion = getCurrentVersion(workspaceFolder);

        // Show version type selection
        const versionType = await vscode.window.showQuickPick([
            { label: 'patch', description: `${currentVersion} → ${incrementVersion(currentVersion, 'patch')}` },
            { label: 'minor', description: `${currentVersion} → ${incrementVersion(currentVersion, 'minor')}` },
            { label: 'major', description: `${currentVersion} → ${incrementVersion(currentVersion, 'major')}` }
        ], {
            placeHolder: 'Select version increment type:'
        });

        if (!versionType) return;

        // Execute update script
        const terminal = vscode.window.createTerminal('Smart Conda - Update Version');
        terminal.sendText(`node scripts/update-version.js ${versionType.label}`);
        terminal.show();

        const targetVersion = incrementVersion(currentVersion, versionType.label);
        appendStructureLog(
            workspaceFolder,
            `Versione aggiornata a ${targetVersion} (tipo: ${versionType.label})`
        );

        vscode.window.showInformationMessage(`Version update initiated: ${versionType.label}`);

    } catch (error) {
        vscode.window.showErrorMessage(`Version update failed: ${error.message}`);
    }
}

function getWorkspaceFolder() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

// Offline documentation helper: append a dated entry to STRUTTURA_PROGETTO.md
function appendStructureLog(workspaceFolder, reason) {
    try {
        const docPath = path.join(workspaceFolder, 'STRUTTURA_PROGETTO.md');
        const timestamp = new Date().toLocaleString('it-IT', { hour12: false });
        const entry = `\n### Aggiornamento – ${timestamp}\n- ${reason}\n\n`;
        if (fs.existsSync(docPath)) {
            fs.appendFileSync(docPath, entry, 'utf8');
        } else {
            // Create file with a minimal header if missing
            fs.writeFileSync(docPath, `# Struttura del Progetto\n\n${entry}`, 'utf8');
        }
    } catch (e) {
        console.error('Append STRUTTURA_PROGETTO.md failed:', e);
    }
}

function detectProjectType(workspaceFolder) {
    const files = fs.readdirSync(workspaceFolder);

    const hasPython = files.includes('pyproject.toml') || files.includes('environment.yml') || files.includes('requirements.txt');
    const hasNode = files.includes('package.json');

    if (hasPython && hasNode) return 'Mixed';
    if (hasPython) return 'Python';
    if (hasNode) return 'Node.js';
    return 'Unknown';
}

async function getCondaEnvironments() {
    try {
        const isWindows = process.platform === 'win32';

        // Get conda base path first
        let condaBase;
        try {
            condaBase = execSync('conda info --base', {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true
            }).trim();
        } catch (e) {
            // Fallback to common paths if command fails
            const homeDir = require('os').homedir();
            if (isWindows) {
                condaBase = 'C:\\ProgramData\\miniconda3';
                if (!fs.existsSync(condaBase)) {
                    condaBase = path.join(homeDir, 'miniconda3');
                }
                if (!fs.existsSync(condaBase)) {
                    condaBase = path.join(homeDir, 'anaconda3');
                }
            } else {
                condaBase = path.join(homeDir, 'miniconda3');
                if (!fs.existsSync(condaBase)) {
                    condaBase = path.join(homeDir, 'anaconda3');
                }
            }
        }

        // Get list of conda environments using multiple methods
        const environments = [];

        // Method 1: conda env list command (primary)
        try {
            const condaEnvList = execSync('conda env list --json', {
                encoding: 'utf8',
                windowsHide: true,
                timeout: 10000
            });
            const envData = JSON.parse(condaEnvList);

            for (const envPath of envData.envs) {
                // Skip if path doesn't exist
                if (!fs.existsSync(envPath)) continue;

                const envName = path.basename(envPath);

                // Platform-specific paths
                const pythonPath = isWindows
                    ? path.join(envPath, 'python.exe')
                    : path.join(envPath, 'bin', 'python');

                // Use conda base for conda executable
                const condaPath = isWindows
                    ? path.join(condaBase, 'Scripts', 'conda.exe')
                    : path.join(condaBase, 'bin', 'conda');

                // Try to get Python version
                let pythonVersion = 'Unknown';
                try {
                    const versionCmd = isWindows
                        ? `"${pythonPath}" --version 2>&1`
                        : `"${pythonPath}" --version 2>&1`;

                    const versionOutput = execSync(versionCmd, {
                        encoding: 'utf8',
                        timeout: 5000,
                        windowsHide: true
                    });
                    pythonVersion = versionOutput.trim().replace('Python ', '');
                } catch (e) {
                    // Ignore version detection errors
                }

                environments.push({
                    name: envName,
                    path: envPath,
                    python: pythonPath,
                    conda: condaPath,
                    python_version: pythonVersion
                });
            }
        } catch (error) {
            console.log('Conda env list command failed, trying alternative methods...');
        }

        // Method 2: Scan all possible envs directories (fallback for Windows)
        if (environments.length === 0 || isWindows) {
            const possibleEnvsDirs = [
                path.join(condaBase, 'envs'),
                path.join(require('os').homedir(), '.conda', 'envs') // ← QUESTA È FUNDAMENTALE
            ];

            for (const envsDir of possibleEnvsDirs) {
                if (fs.existsSync(envsDir)) {
                    try {
                        const entries = fs.readdirSync(envsDir, { withFileTypes: true });
                        const envDirs = entries
                            .filter(entry => entry.isDirectory())
                            .map(entry => entry.name);

                        for (const envName of envDirs) {
                            // Skip if we already have this environment
                            if (environments.some(env => env.name === envName)) continue;

                            const envPath = path.join(envsDir, envName);
                            const pythonPath = isWindows
                                ? path.join(envPath, 'python.exe')
                                : path.join(envPath, 'bin', 'python');

                            const condaPath = isWindows
                                ? path.join(condaBase, 'Scripts', 'conda.exe')
                                : path.join(condaBase, 'bin', 'conda');

                            // Try to get Python version
                            let pythonVersion = 'Unknown';
                            try {
                                if (fs.existsSync(pythonPath)) {
                                    const versionCmd = isWindows
                                        ? `"${pythonPath}" --version 2>&1`
                                        : `"${pythonPath}" --version 2>&1`;

                                    const versionOutput = execSync(versionCmd, {
                                        encoding: 'utf8',
                                        timeout: 5000,
                                        windowsHide: true
                                    });
                                    pythonVersion = versionOutput.trim().replace('Python ', '');
                                }
                            } catch (e) {
                                // Ignore version detection errors
                            }

                            environments.push({
                                name: envName,
                                path: envPath,
                                python: pythonPath,
                                conda: condaPath,
                                python_version: pythonVersion
                            });
                        }
                    } catch (e) {
                        console.log(`Failed to scan ${envsDir}:`, e.message);
                    }
                }
            }

            // Add base environment if not present
            if (!environments.some(env => env.name === 'base')) {
                const basePythonPath = isWindows
                    ? path.join(condaBase, 'python.exe')
                    : path.join(condaBase, 'bin', 'python');

                const baseCondaPath = isWindows
                    ? path.join(condaBase, 'Scripts', 'conda.exe')
                    : path.join(condaBase, 'bin', 'conda');

                let basePythonVersion = 'Unknown';
                try {
                    if (fs.existsSync(basePythonPath)) {
                        const versionCmd = isWindows
                            ? `"${basePythonPath}" --version 2>&1`
                            : `"${basePythonPath}" --version 2>&1`;

                        const versionOutput = execSync(versionCmd, {
                            encoding: 'utf8',
                            timeout: 5000,
                            windowsHide: true
                        });
                        basePythonVersion = versionOutput.trim().replace('Python ', '');
                    }
                } catch (e) {
                    // Ignore version detection errors
                }

                environments.push({
                    name: 'base',
                    path: condaBase,
                    python: basePythonPath,
                    conda: baseCondaPath,
                    python_version: basePythonVersion
                });
            }
        }

        // Sort environments: current active first, then alphabetically
        const currentEnv = getCurrentCondaEnv();
        environments.sort((a, b) => {
            if (a.name === currentEnv && b.name !== currentEnv) return -1;
            if (b.name === currentEnv && a.name !== currentEnv) return 1;
            return a.name.localeCompare(b.name);
        });

        return environments;

    } catch (error) {
        console.error('Failed to get conda environments:', error);

        // Enhanced fallback
        const homeDir = require('os').homedir();
        const isWindows = process.platform === 'win32';

        let condaBase;
        const possiblePaths = [];

        if (isWindows) {
            possiblePaths.push(
                path.join(homeDir, 'miniconda3'),
                path.join(homeDir, 'anaconda3'),
                path.join(homeDir, '.conda'), // ← AGGIUNTA IMPORTANTE
                'C:\\ProgramData\\miniconda3',
                'C:\\ProgramData\\anaconda3',
                'C:\\Miniconda3',
                'C:\\Anaconda3'
            );
        } else {
            possiblePaths.push(
                path.join(homeDir, 'miniconda3'),
                path.join(homeDir, 'anaconda3'),
                '/opt/miniconda3',
                '/opt/anaconda3'
            );
        }

        for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
                condaBase = possiblePath;
                break;
            }
        }

        if (!condaBase) {
            // Ultimate fallback
            condaBase = isWindows
                ? path.join(homeDir, 'miniconda3')
                : path.join(homeDir, 'miniconda3');
        }

        // Get all environments by scanning all possible locations
        const envNames = new Set(['base']);
        const possibleEnvsDirs = [
            path.join(condaBase, 'envs'),
            path.join(homeDir, '.conda', 'envs') // ← ANCHE QUI
        ];

        for (const envsDir of possibleEnvsDirs) {
            if (fs.existsSync(envsDir)) {
                try {
                    const entries = fs.readdirSync(envsDir, { withFileTypes: true });
                    const envDirs = entries
                        .filter(entry => entry.isDirectory())
                        .map(entry => entry.name);

                    envDirs.forEach(envName => envNames.add(envName));
                } catch (e) {
                    console.error('Failed to read envs directory:', e);
                }
            }
        }

        return Array.from(envNames).map(envName => {
            const envPath = envName === 'base' ? condaBase :
                           [path.join(condaBase, 'envs', envName),
                            path.join(homeDir, '.conda', 'envs', envName)]
                           .find(p => fs.existsSync(p)) || path.join(condaBase, 'envs', envName);

            return {
                name: envName,
                path: envPath,
                python: isWindows
                    ? path.join(envPath, 'python.exe')
                    : path.join(envPath, 'bin', 'python'),
                conda: isWindows
                    ? path.join(condaBase, 'Scripts', 'conda.exe')
                    : path.join(condaBase, 'bin', 'conda'),
                python_version: 'Unknown'
            };
        });
    }
}

function getCurrentCondaEnv() {
    try {
        const condaInfo = execSync('conda info --json', { encoding: 'utf8' });
        const info = JSON.parse(condaInfo);
        const activeEnv = info.active_prefix;

        if (activeEnv) {
            return path.basename(activeEnv);
        }
    } catch (error) {
        // Ignore errors
    }

    return null;
}


// Versioning utilities moved to modules/version.js

async function createRequirementsCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        const envs = await getCondaEnvironments();
        if (!envs || envs.length === 0) {
            vscode.window.showErrorMessage('No conda environments found');
            return;
        }

        const picked = await vscode.window.showQuickPick(
            envs.map(env => ({ label: env.name, description: env.path, detail: `Python: ${env.python_version || 'Unknown'}`, env })),
            { placeHolder: 'Select environment to export requirements.txt' }
        );
        if (!picked) return;

        const defaultPath = path.join(workspaceFolder, 'requirements.txt');
        const outPath = await vscode.window.showInputBox({ prompt: 'Percorso file requirements.txt', value: defaultPath });
        if (!outPath) return;

        const method = await vscode.window.showQuickPick([
            { label: 'Conda export (conda list -e)', key: 'conda' },
            { label: 'Pip freeze (pip list --format=freeze)', key: 'pip' }
        ], { placeHolder: 'Metodo di generazione requirements.txt' });
        if (!method) return;

        const terminal = vscode.window.createTerminal('Smart Conda - Requirements');
        const quotedOut = `"${outPath}"`;
        if (method.key === 'conda') {
            terminal.sendText(`conda list -e -n "${picked.env.name}" > ${quotedOut}`);
        } else {
            terminal.sendText(`conda run -n "${picked.env.name}" python -m pip list --format=freeze > ${quotedOut}`);
        }
        terminal.show();

        setTimeout(() => {
            try {
                if (fs.existsSync(outPath)) {
                    const sz = fs.statSync(outPath).size;
                    if (sz > 0) vscode.window.showInformationMessage('requirements.txt generato');
                }
            } catch (_) {}
        }, 2000);

        appendStructureLog(workspaceFolder, `Comando generazione requirements.txt inviato al Terminale per env '${picked.env.name}' (metodo: ${method.key}).`);

        appendStructureLog(workspaceFolder, `Generato/aggiornato requirements.txt dall'ambiente '${picked.env.name}'.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Create Requirements failed: ${error.message}`);
    }
}

function convertCondaExportToPip(raw) {
    return raw
        .split(/\r?\n/)
        .map(l => {
            if (!l || l.startsWith('#')) return '';
            const parts = l.split('=');
            if (parts.length >= 2) {
                const name = parts[0];
                const version = parts[1];
                return `${name}==${version}`;
            }
            return '';
        })
        .filter(Boolean)
        .join('\n');
}

async function createEnvironmentCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        const envName = await vscode.window.showInputBox({ prompt: 'Nome nuovo ambiente Conda' });
        if (!envName) return;

        const pyPick = await vscode.window.showQuickPick(['3.12', '3.11', '3.10', '3.9'].map(v => ({ label: v })), { placeHolder: 'Versione Python' });
        if (!pyPick) return;

        const source = await vscode.window.showQuickPick([
            { label: 'Nessuna', detail: 'Ambiente base con Python' },
            { label: 'requirements.txt', detail: 'Installa da requirements.txt' },
            { label: 'environment.yml', detail: 'Crea da environment.yml' }
        ], { placeHolder: 'Sorgente pacchetti' });
        if (!source) return;

        const terminal = vscode.window.createTerminal('Smart Conda - Create Environment');
        const reqPath = path.join(workspaceFolder, 'requirements.txt');
        const envYml = path.join(workspaceFolder, 'environment.yml');

        if (source.label === 'environment.yml') {
            if (!fs.existsSync(envYml)) {
                vscode.window.showErrorMessage('environment.yml non trovato nella radice del workspace');
                return;
            }
            terminal.sendText(`conda env create -f "${envYml}" -n "${envName}"`);
        } else {
            terminal.sendText(`conda create -y -n "${envName}" python=${pyPick.label}`);
            if (source.label === 'requirements.txt') {
                if (!fs.existsSync(reqPath)) {
                    vscode.window.showErrorMessage('requirements.txt non trovato nella radice del workspace');
                    return;
                }
                terminal.sendText(`conda run -n "${envName}" python -m pip install -r "${reqPath}"`);
            }
        }
        terminal.show();

        appendStructureLog(workspaceFolder, `Creazione ambiente Conda '${envName}' (Python ${pyPick.label}) sorgente: ${source.label}.`);
        vscode.window.showInformationMessage(`Creazione ambiente '${envName}' avviata`);
    } catch (error) {
        vscode.window.showErrorMessage(`Create Environment failed: ${error.message}`);
    }
}

async function exportEnvironmentYmlCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        const envs = await getCondaEnvironments();
        if (!envs || envs.length === 0) {
            vscode.window.showErrorMessage('No conda environments found');
            return;
        }

        const picked = await vscode.window.showQuickPick(
            envs.map(env => ({ label: env.name, description: env.path, detail: `Python: ${env.python_version || 'Unknown'}`, env })),
            { placeHolder: 'Select environment to export environment.yml' }
        );
        if (!picked) return;

        const defaultPath = path.join(workspaceFolder, 'environment.yml');
        const outPath = await vscode.window.showInputBox({ prompt: 'Percorso file environment.yml', value: defaultPath });
        if (!outPath) return;

        const terminal = vscode.window.createTerminal('Smart Conda - Export Environment');
        terminal.sendText(`conda env export -n "${picked.env.name}" -f "${outPath}"`);
        terminal.show();

        setTimeout(() => {
            try {
                if (fs.existsSync(outPath)) {
                    const sz = fs.statSync(outPath).size;
                    if (sz > 0) vscode.window.showInformationMessage('environment.yml esportato');
                }
            } catch (_) {}
        }, 2000);

        appendStructureLog(workspaceFolder, `Export environment.yml inviato al Terminale per env '${picked.env.name}'.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Export Environment.yml failed: ${error.message}`);
    }
}
class SmartCondaProvider {
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) return Promise.resolve([]);
        const items = [
            { label: 'Configure Workspace', command: 'smartCondaWorkspace.configureWorkspace', icon: 'gear' },
            { label: 'Update Version', command: 'smartCondaWorkspace.updateVersion', icon: 'tag' },
            { label: 'Create New Environment', command: 'smartCondaWorkspace.createEnvironment', icon: 'add' },
            { label: 'Create Requirements.txt', command: 'smartCondaWorkspace.createRequirements', icon: 'list-ordered' },
            { label: 'Export Environment.yml', command: 'smartCondaWorkspace.exportEnvironmentYml', icon: 'file' },
        ];
        return Promise.resolve(items.map(i => new CommandTreeItem(i.label, i.command, i.icon)));
    }
}

class CommandTreeItem extends vscode.TreeItem {
    constructor(label, command, icon) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command, title: label };
        this.iconPath = new vscode.ThemeIcon(icon || 'gear');
    }
}


function deactivate() {}

module.exports = {
    activate,
    deactivate
};
// Utility: append entry to README-like files
function appendReadmeLog(filePath, reason) {
    try {
        const timestamp = new Date().toLocaleString('it-IT', { hour12: false });
        const entry = `\n### Aggiornamento – ${timestamp}\n- Motivo: ${reason}\n\n`;
        if (fs.existsSync(filePath)) {
            fs.appendFileSync(filePath, entry, 'utf8');
        } else {
            fs.writeFileSync(filePath, `# Aggiornamenti\n${entry}`, 'utf8');
        }
    } catch (e) {
        console.error('Append README log failed:', e);
    }
}

function findReadmeFiles(rootDir, maxDepth = 2) {
    const results = [];
    const exclude = new Set(['node_modules', '.git', 'dist', 'out']);

    function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!exclude.has(entry.name)) walk(full, depth + 1);
            } else if (entry.isFile()) {
                const nameLower = entry.name.toLowerCase();
                if (nameLower === 'readme.md') results.push(full);
            }
        }
    }

    walk(rootDir, 0);
    return results;
}

async function logUpdateCommand() {
    try {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        const reason = await vscode.window.showInputBox({
            prompt: 'Motivo dell’aggiornamento (obbligatorio)',
            placeHolder: 'Es. Documentazione aggiornata, configurata auto‑attivazione, fix impostazioni...'
        });
        if (!reason) return;

        // Opzioni aggiuntive
        const optionItems = [
            { label: 'Includi OS/ambiente automaticamente', key: 'includeEnv' },
            { label: 'Apri i file aggiornati in editor', key: 'openFiles' },
            { label: 'Configura profondità scansione README', key: 'setDepth' }
        ];
        const selectedOptions = await vscode.window.showQuickPick(optionItems, {
            placeHolder: 'Seleziona opzioni facoltative',
            canPickMany: true
        });

        // Profondità di scansione
        let scanDepth = 2;
        if (selectedOptions && selectedOptions.some(o => o.key === 'setDepth')) {
            const depthStr = await vscode.window.showInputBox({
                prompt: 'Profondità di scansione README (1–4)',
                placeHolder: '2'
            });
            const parsed = parseInt(depthStr || '2', 10);
            if (!isNaN(parsed)) scanDepth = Math.max(1, Math.min(4, parsed));
        }

        // Motivo con OS/ambiente
        let finalReason = reason;
        if (selectedOptions && selectedOptions.some(o => o.key === 'includeEnv')) {
            const osLabel = getOsLabel();
            const envName = inferEnvNameFromWorkspace(workspaceFolder);
            finalReason = `${reason} (OS: ${osLabel}; Env: ${envName})`;
        }

        // Sempre scrivi su STRUTTURA_PROGETTO.md (nella cartella del workspace)
        appendStructureLog(workspaceFolder, `Motivo: ${finalReason}`);

        // Se esiste STRUTTURA_PROGETTO.md alla radice del progetto (cartella padre), append anche lì
        try {
            const parentDir = path.dirname(workspaceFolder);
            const parentStruct = path.join(parentDir, 'STRUTTURA_PROGETTO.md');
            if (fs.existsSync(parentStruct) && parentDir !== workspaceFolder) {
                appendStructureLog(parentDir, `Motivo: ${finalReason}`);
                if (selectedOptions && selectedOptions.some(o => o.key === 'openFiles')) {
                    try { await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(parentStruct)); } catch (_) {}
                }
            }
        } catch (_) {}

        // Rileva README e offri selezione multipla
        const readmes = findReadmeFiles(workspaceFolder, scanDepth);
        if (readmes.length > 0) {
            const picks = await vscode.window.showQuickPick(
                readmes.map(f => ({ label: path.relative(workspaceFolder, f), file: f })),
                { placeHolder: 'Seleziona README da aggiornare (facoltativo)', canPickMany: true }
            );
            if (picks && picks.length > 0) {
                for (const p of picks) appendReadmeLog(p.file, finalReason);
                if (selectedOptions && selectedOptions.some(o => o.key === 'openFiles')) {
                    for (const p of picks) {
                        try { await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(p.file)); } catch (_) {}
                    }
                }
            }
        }

        vscode.window.showInformationMessage('Log aggiornamento registrato.');
    } catch (error) {
        vscode.window.showErrorMessage(`Log Update failed: ${error.message}`);
    }
}

// (Rimosso) Comando append-struct-log.sh: eliminato su richiesta

// getOsLabel & inferEnvNameFromWorkspace ora importati da modules/env