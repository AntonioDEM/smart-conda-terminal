const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let templates = {};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Smart Conda Workspace extension activated');

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

    context.subscriptions.push(configureWorkspace, updateVersion);
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
        const workspaceConfig = generateWorkspaceConfig(workspaceFolder, selectedEnv.env, selectedType.label.toLowerCase());

        // Write workspace file
        const workspaceFile = path.join(workspaceFolder, `${path.basename(workspaceFolder)}.code-workspace`);
        fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

        // Configure shell auto-activation
        await configureShellAutoActivation(workspaceFolder, selectedEnv.env);

        // Show success message with option to open workspace
        const action = await vscode.window.showInformationMessage(
            `Workspace configured for ${selectedType.label} project with environment: ${selectedEnv.env.name}`,
            'Open Workspace Now', 'Manual Reload'
        );

        if (action === 'Open Workspace Now') {
            // Close current window and open workspace
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFile), { forceNewWindow: false });
        } else if (action === 'Manual Reload') {
            vscode.window.showInformationMessage(`Please open: ${path.basename(workspaceFile)}`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Configuration failed: ${error.message}`);
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
        // Get list of conda environments
        const condaEnvList = execSync('conda env list --json', { encoding: 'utf8' });
        const envData = JSON.parse(condaEnvList);

        const environments = [];
        const isWindows = process.platform === 'win32';

        for (const envPath of envData.envs) {
            const envName = path.basename(envPath);

            // Platform-specific paths
            const pythonPath = isWindows
                ? path.join(envPath, 'python.exe')
                : path.join(envPath, 'bin', 'python');

            const condaPath = isWindows
                ? path.join(path.dirname(envPath), 'Scripts', 'conda.exe')
                : path.join(path.dirname(envPath), 'bin', 'conda');

            // Try to get Python version
            let pythonVersion = 'Unknown';
            try {
                const versionCmd = isWindows
                    ? `"${pythonPath}" --version 2>&1`
                    : `"${pythonPath}" --version 2>&1`;

                const versionOutput = execSync(versionCmd, {
                    encoding: 'utf8',
                    timeout: 5000
                });
                pythonVersion = versionOutput.trim();
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

        // Fallback: create default environment info based on platform
        const homeDir = require('os').homedir();
        const isWindows = process.platform === 'win32';

        let condaBase;
        if (isWindows) {
            condaBase = path.join(homeDir, 'miniconda3');
            if (!fs.existsSync(condaBase)) {
                condaBase = path.join(homeDir, 'anaconda3');
            }
        } else {
            condaBase = path.join(homeDir, 'miniconda3');
            if (!fs.existsSync(condaBase)) {
                condaBase = path.join(homeDir, 'anaconda3');
            }
        }

        const defaultEnvs = ['base', 'sct-dev'];

        return defaultEnvs.map(envName => {
            const envPath = envName === 'base' ? condaBase : path.join(condaBase, 'envs', envName);

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

function generateWorkspaceConfig(workspaceFolder, condaEnv, projectType) {
    const folderName = path.basename(workspaceFolder);
    const baseTemplate = templates.base || {};
    const typeTemplate = templates[projectType] || {};
    const isWindows = process.platform === 'win32';

    // Merge templates
    const config = {
        folders: [{ path: "." }],
        settings: {
            ...baseTemplate.settings,
            ...typeTemplate.settings,
            // Conda-specific settings
            "python.defaultInterpreterPath": condaEnv.python,
            "python.condaPath": condaEnv.conda,
            "python.terminal.activateEnvironment": true
        },
        extensions: {
            recommendations: [
                ...(baseTemplate.extensions?.recommendations || []),
                ...(typeTemplate.extensions?.recommendations || [])
            ]
        }
    };

    // Platform-specific terminal integration
    if (isWindows) {
        // Windows PowerShell integration
        config.settings["terminal.integrated.defaultProfile.windows"] = "conda-env";
        config.settings["terminal.integrated.profiles.windows"] = {
            "conda-env": {
                "path": "powershell.exe",
                "args": [
                    "-NoExit",
                    "-Command",
                    `conda activate ${condaEnv.name}`
                ]
            }
        };
    } else {
        // macOS/Linux integration
        const shellPath = process.env.SHELL || '/bin/bash';
        const shellName = path.basename(shellPath);
        const condaInitScript = path.join(path.dirname(condaEnv.conda), '..', 'etc', 'profile.d', 'conda.sh');

        if (process.platform === 'darwin') {
            // macOS
            config.settings["terminal.integrated.defaultProfile.osx"] = "conda-env";
            config.settings["terminal.integrated.profiles.osx"] = {
                "conda-env": {
                    "path": shellPath,
                    "args": ["-l", "-c", `source ${condaInitScript} && conda activate ${condaEnv.name}; exec ${shellName}`]
                }
            };
        } else {
            // Linux
            config.settings["terminal.integrated.defaultProfile.linux"] = "conda-env";
            config.settings["terminal.integrated.profiles.linux"] = {
                "conda-env": {
                    "path": shellPath,
                    "args": ["-l", "-c", `source ${condaInitScript} && conda activate ${condaEnv.name}; exec ${shellName}`]
                }
            };
        }
    }

    return config;
}

function getCurrentVersion(workspaceFolder) {
    try {
        // Try package.json first
        const packageJsonPath = path.join(workspaceFolder, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version || '0.0.0';
        }

        // Try pyproject.toml
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

async function configureShellAutoActivation(workspaceFolder, condaEnv) {
    try {
        const homeDir = require('os').homedir();
        const projectName = path.basename(workspaceFolder);
        const functionName = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
        const isWindows = process.platform === 'win32';

        // Detect shell and config file
        let shellConfig = '';
        let shellType = '';

        if (isWindows) {
            // Windows PowerShell support
            const psProfile = path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
            const ps5Profile = path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');

            if (fs.existsSync(psProfile)) {
                shellConfig = psProfile;
                shellType = 'powershell';
            } else if (fs.existsSync(ps5Profile)) {
                shellConfig = ps5Profile;
                shellType = 'powershell5';
            } else {
                // Create PowerShell profile if it doesn't exist
                const psDir = path.dirname(psProfile);
                if (!fs.existsSync(psDir)) {
                    fs.mkdirSync(psDir, { recursive: true });
                }
                shellConfig = psProfile;
                shellType = 'powershell';
                // Create empty profile
                fs.writeFileSync(shellConfig, '# PowerShell Profile\n');
            }
        } else {
            // Unix systems (macOS/Linux)
            const currentShell = process.env.SHELL || '';

            if (currentShell.includes('zsh')) {
                shellConfig = path.join(homeDir, '.zshrc');
                shellType = 'zsh';
            } else if (currentShell.includes('bash')) {
                shellConfig = path.join(homeDir, '.bash_profile');
                if (!fs.existsSync(shellConfig)) {
                    shellConfig = path.join(homeDir, '.bashrc');
                }
                shellType = 'bash';
            } else {
                console.log('Unsupported shell:', currentShell);
                return false;
            }
        }

        if (!fs.existsSync(shellConfig)) {
            console.log('Shell config file not found:', shellConfig);
            return false;
        }

        // Read current shell config
        const shellContent = fs.readFileSync(shellConfig, 'utf8');

        // Check if configuration already exists
        const configMarker = `# *${projectName}* - Auto-activation`;
        if (shellContent.includes(configMarker)) {
            console.log('Auto-activation already configured for', projectName);
            return true;
        }

        // Create backup
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const backupFile = `${shellConfig}.backup.${timestamp}`;
        fs.writeFileSync(backupFile, shellContent);
        console.log('Shell config backup created:', backupFile);

        // Generate auto-activation configuration based on shell type
        const dateString = new Date().toLocaleString('it-IT', {
            timeZone: 'Europe/Rome',
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let autoActivationConfig = '';

        if (shellType === 'powershell' || shellType === 'powershell5') {
            // PowerShell configuration
            const windowsWorkspacePath = workspaceFolder.replace(/\\/g, '\\\\');

            autoActivationConfig = `

# *${projectName}* - Auto-activation
# Generated by Smart Conda Workspace on ${dateString}
function ${functionName} {
    $currentPath = Get-Location
    if ($currentPath.Path -like "*${windowsWorkspacePath}*") {
        try {
            conda activate ${condaEnv.name}
        } catch {
            Write-Host "Failed to activate conda environment: ${condaEnv.name}" -ForegroundColor Yellow
        }
    }
}

# PowerShell integration - auto-activate on directory change
$global:SmartCondaProjects = @()
if (-not ($global:SmartCondaProjects -contains "${functionName}")) {
    $global:SmartCondaProjects += "${functionName}"
}

# Override Set-Location to trigger activation
if (-not (Get-Command "Set-Location-Original" -ErrorAction SilentlyContinue)) {
    Set-Alias -Name "Set-Location-Original" -Value "Set-Location" -Force
    function Set-Location {
        param([string]$Path, [switch]$PassThru)
        Set-Location-Original @PSBoundParameters
        foreach ($func in $global:SmartCondaProjects) {
            & $func
        }
    }
    Set-Alias -Name "cd" -Value "Set-Location" -Force
}

# Activate now
${functionName}
`;
        } else {
            // Unix shells (zsh/bash)
            autoActivationConfig = `

# *${projectName}* - Auto-activation
# Generated by Smart Conda Workspace on ${dateString}
${functionName}() {
    if [[ "$PWD" == *"${workspaceFolder}"* ]]; then
        conda activate ${condaEnv.name} 2>/dev/null || true
    fi
}

`;

            // Add shell-specific integration
            if (shellType === 'zsh') {
                autoActivationConfig += `# ZSH integration
if [[ -n "$ZSH_VERSION" ]]; then
    chpwd_functions+=(${functionName})
    ${functionName}  # Activate now
fi
`;
            } else if (shellType === 'bash') {
                autoActivationConfig += `# Bash integration
if [[ -n "$BASH_VERSION" ]]; then
    PROMPT_COMMAND="${functionName};\$PROMPT_COMMAND"
    ${functionName}  # Activate now
fi
`;
            }
        }

        // Append to shell config
        fs.appendFileSync(shellConfig, autoActivationConfig);

        console.log(`Auto-activation configured for ${projectName} -> ${condaEnv.name}`);
        console.log(`Function: ${functionName}`);
        console.log(`Shell config: ${shellConfig}`);
        console.log(`Shell type: ${shellType}`);

        return true;

    } catch (error) {
        console.error('Failed to configure shell auto-activation:', error);
        vscode.window.showWarningMessage(`Shell auto-activation failed: ${error.message}`);
        return false;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};