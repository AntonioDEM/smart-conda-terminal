const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Smart Conda Terminal extension is now active!');

    // Register commands
    const setupProjectCommand = vscode.commands.registerCommand('smartCondaTerminal.setupProject', setupProject);
    const switchEnvironmentCommand = vscode.commands.registerCommand('smartCondaTerminal.switchEnvironment', switchEnvironment);
    const createEnvironmentCommand = vscode.commands.registerCommand('smartCondaTerminal.createEnvironment', createEnvironment);
    const healthCheckCommand = vscode.commands.registerCommand('smartCondaTerminal.healthCheck', healthCheck);
    const cleanupProjectCommand = vscode.commands.registerCommand('smartCondaTerminal.cleanupProject', cleanupProject);
    const syncEnvironmentCommand = vscode.commands.registerCommand('smartCondaTerminal.syncEnvironment', syncEnvironment);

    // Add to subscriptions
    context.subscriptions.push(
        setupProjectCommand,
        switchEnvironmentCommand,
        createEnvironmentCommand,
        healthCheckCommand,
        cleanupProjectCommand,
        syncEnvironmentCommand
    );

    // Auto-setup if enabled
    const config = vscode.workspace.getConfiguration('smartCondaTerminal');
    if (config.get('autoSetup', true)) {
        autoSetupProject();
    }
}

function deactivate() {
    console.log('Smart Conda Terminal extension deactivated');
}

// Command implementations
async function setupProject() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    
    try {
        // Check for conda environment files
        const envFiles = await findCondaEnvironmentFiles(workspacePath);
        
        if (envFiles.length === 0) {
            vscode.window.showInformationMessage('No conda environment files found in workspace');
            return;
        }

        vscode.window.showInformationMessage(`Found ${envFiles.length} conda environment file(s)`);
        
        // Setup logic here
        await configureTerminalIntegration(workspacePath);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
    }
}

async function switchEnvironment() {
    // Implementation for switching environments
    vscode.window.showInformationMessage('Switch Environment command executed');
}

async function createEnvironment() {
    // Implementation for creating new environments
    vscode.window.showInformationMessage('Create Environment command executed');
}

async function healthCheck() {
    // Implementation for health check
    vscode.window.showInformationMessage('Health Check command executed');
}

async function cleanupProject() {
    // Implementation for cleanup
    vscode.window.showInformationMessage('Cleanup Project command executed');
}

async function syncEnvironment() {
    // Implementation for syncing with environment.yml
    vscode.window.showInformationMessage('Sync Environment command executed');
}

async function autoSetupProject() {
    // Auto-setup logic
    console.log('Auto-setup triggered');
}

async function findCondaEnvironmentFiles(workspacePath) {
    const envFiles = [];
    const possibleFiles = [
        'environment.yml',
        'environment.yaml',
        'pyproject.toml',
        '.condarc'
    ];

    for (const file of possibleFiles) {
        const filePath = path.join(workspacePath, file);
        if (fs.existsSync(filePath)) {
            envFiles.push(file);
        }
    }

    return envFiles;
}

async function configureTerminalIntegration(workspacePath) {
    // Terminal integration configuration
    console.log('Configuring terminal integration for:', workspacePath);
}

module.exports = {
    activate,
    deactivate
};
