const fs = require('fs');
const path = require('path');

function generateWorkspaceConfig(workspaceFolder, condaEnv, projectType, templates) {
  const baseTemplate = (templates && templates.base) || {};
  const typeTemplate = (templates && templates[projectType]) || {};
  const isWindows = process.platform === 'win32';

  const config = {
    folders: [{ path: '.' }],
    settings: {
      ...(baseTemplate.settings || {}),
      ...(typeTemplate.settings || {}),
      // Conda-specific settings
      'python.defaultInterpreterPath': condaEnv.python,
      'python.condaPath': condaEnv.conda,
      'python.terminal.activateEnvironment': true,
    },
    extensions: {
      recommendations: [
        ...((baseTemplate.extensions && baseTemplate.extensions.recommendations) || []),
        ...((typeTemplate.extensions && typeTemplate.extensions.recommendations) || []),
      ],
    },
  };

  if (isWindows) {
    const condaHookPath = path.join(path.dirname(condaEnv.conda), '..', 'Lib', 'site-packages', 'conda', 'shell', 'condabin', 'conda-hook.ps1');
    const activateBatPath = path.join(path.dirname(condaEnv.conda), 'activate.bat');

    config.settings['terminal.integrated.defaultProfile.windows'] = 'conda-env';
    config.settings['terminal.integrated.profiles.windows'] = {
      'conda-env': {
        path: 'C\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        args: [
          '-ExecutionPolicy', 'ByPass',
          '-NoExit',
          '-Command',
          `& '${condaHookPath}'; conda activate ${condaEnv.name}; Clear-Host; $py = (python --version 2>$null); $node = ''; if (Get-Command node -ErrorAction SilentlyContinue) { $node = '; Node: ' + (node --version 2>$null); } $npm = ''; if (Get-Command npm -ErrorAction SilentlyContinue) { $npm = '; npm: ' + (npm --version 2>$null); } Write-Host '🐍 Ambiente ${condaEnv.name} attivato!: ' -ForegroundColor Green -NoNewline; Write-Host ($py + $node + $npm) -ForegroundColor Cyan;`,
        ],
        icon: 'terminal-powershell',
        color: 'terminal.ansiGreen',
      },
      'conda-env-cmd': {
        path: 'C\\Windows\\System32\\cmd.exe',
        args: [
          '/K',
          `"${activateBatPath}" ${condaEnv.name} && setlocal EnableDelayedExpansion && for /f "tokens=* delims=" %P in ('python --version 2^>nul') do set PY=%P && set MSG=Python: !PY! && (where node >nul 2>nul && for /f "tokens=* delims=" %N in ('node --version 2^>nul') do set MSG=!MSG!; Node: %N) && (where npm >nul 2>nul && for /f "tokens=* delims=" %M in ('npm --version 2^>nul') do set MSG=!MSG!; npm: %M) && echo Ambiente ${condaEnv.name} attivato!: !MSG!`,
        ],
        icon: 'terminal-cmd',
        color: 'terminal.ansiBlue',
      },
      PowerShell: {
        source: 'PowerShell',
        icon: 'terminal-powershell',
      },
    };

    Object.assign(config.settings, {
      'terminal.integrated.defaultLocation': 'editor',
      'terminal.integrated.enableMultiLinePasteWarning': 'never',
      'files.eol': '\n',
      'files.encoding': 'utf8',
    });
  } else {
    const shellPath = process.env.SHELL || '/bin/bash';
    const shellName = path.basename(shellPath);
    const condaInitScript = path.join(path.dirname(condaEnv.conda), '..', 'etc', 'profile.d', 'conda.sh');
    const hasCondaSh = fs.existsSync(condaInitScript);
    const activateSnippet = hasCondaSh
      ? `source ${condaInitScript} && conda activate ${condaEnv.name} >/dev/null 2>&1;`
      : `conda activate ${condaEnv.name} >/dev/null 2>&1;`;

    const unixMessage = `PYV=$(python --version 2>/dev/null); MSG="Python: ${'${'}PYV}"; if command -v node >/dev/null 2>&1; then MSG="${'${'}MSG}; Node: $(node --version 2>/dev/null)"; fi; if command -v npm >/dev/null 2>&1; then MSG="${'${'}MSG}; npm: $(npm --version 2>/dev/null)"; fi; printf '\\033[32m🐍 Ambiente ${condaEnv.name} attivato!\\033[0m: \\033[36m%s\\033[0m\\n' "${'${'}MSG}"`;

    if (process.platform === 'darwin') {
      config.settings['terminal.integrated.defaultProfile.osx'] = 'conda-env';
      config.settings['terminal.integrated.profiles.osx'] = {
        'conda-env': {
          path: shellPath,
          args: ['-l', '-c', `${activateSnippet} ${unixMessage}; ${shellPath} -l`],
        },
      };
    } else {
      config.settings['terminal.integrated.defaultProfile.linux'] = 'conda-env';
      config.settings['terminal.integrated.profiles.linux'] = {
        'conda-env': {
          path: shellPath,
          args: ['-l', '-c', `${activateSnippet} ${unixMessage}; ${shellPath} -l`],
        },
      };
    }
  }

  return config;
}

module.exports = {
  generateWorkspaceConfig,
};