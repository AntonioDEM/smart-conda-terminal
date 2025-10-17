<p align="center"> <img src="./resources/icons/favicon.svg" width="80" height="80"> </p> <h1 align="center">Smart Conda Terminal</h1> <p align="center"> <i>published as "Smart Conda Workspace"</i> </p> 

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/lang-en-blue.svg" alt="English"></a>
  <a href="README.it.md"><img src="https://img.shields.io/badge/lang-it-green.svg" alt="Italiano"></a>
</p>

<p align="center"> <img src="https://img.shields.io/badge/Python-3.10+-blue.svg" alt="Python"> <img src="https://img.shields.io/badge/Node-24.8.0+-blue.svg" alt="Node"> <img src="https://img.shields.io/badge/status-stable-green.svg" alt="Status"> <img src="https://img.shields.io/badge/last_commit-October_2025-green.svg" alt="Last Commit"> </p> <p align="center"> <a href="https://marketplace.visualstudio.com/items?itemName=AntonioDemarcus.smart-conda-workspace"> <img src="https://img.shields.io/visual-studio-marketplace/v/AntonioDemarcus.smart-conda-workspace?style=flat-square&logo=visual-studio-code&logoColor=white&label=Marketplace" alt="VS Marketplace Version"> </a> <a href="https://marketplace.visualstudio.com/items?itemName=AntonioDemarcus.smart-conda-workspace"> <img src="https://img.shields.io/visual-studio-marketplace/d/AntonioDemarcus.smart-conda-workspace?style=flat-square&logo=visual-studio-code&logoColor=white" alt="Downloads"> </a> <a href="https://marketplace.visualstudio.com/items?itemName=AntonioDemarcus.smart-conda-workspace"> <img src="https://img.shields.io/visual-studio-marketplace/r/AntonioDemarcus.smart-conda-workspace?style=flat-square&logo=visual-studio-code&logoColor=white" alt="Rating"> </a> </p> <p align="center"> <a href="https://github.com/AntonioDemarcus/smart-conda-terminal"> <img src="https://img.shields.io/github/stars/AntonioDemarcus/smart-conda-terminal?style=social" alt="GitHub Stars"> </a> <a href="https://github.com/AntonioDemarcus/smart-conda-terminal/issues"> <img src="https://img.shields.io/github/issues/AntonioDemarcus/smart-conda-terminal?style=flat-square" alt="GitHub Issues"> </a> <a href="https://github.com/AntonioDemarcus/smart-conda-terminal/blob/main/LICENSE"> <img src="https://img.shields.io/github/license/AntonioDemarcus/smart-conda-terminal?style=flat-square" alt="License"> </a> <a href="https://github.com/AntonioDemarcus/smart-conda-terminal/fork"> <img src="https://img.shields.io/github/forks/AntonioDemarcus/smart-conda-terminal?style=social" alt="GitHub Forks"> </a> </p> <h3 align="center">Supported Operating Systems</h3> <p align="center"> <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows"> <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=macos&logoColor=F0F0F0" alt="macOS"> </p>

------

## Table of Contents

- [About](#about)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Modular Architecture](#modular-architecture)
- [Development Commands](#development-commands)
- [Shell Auto-activation](#shell-auto-activation)
- [Building and Packaging](#building-and-packaging)
- [Git Hooks for Documentation Reminders](#git-hooks-for-documentation-reminders)
- [Contributing](#-contributing)
- [Contact](#-contact)
- [License](#-license)
- [Project Information](#project-information)

-----

  ## About

  VS Code extension for automated conda environment management, built with JavaScript.

  ### Project Naming

  This repository, **Smart-Conda-Terminal**, contains the source code for the **"Smart Conda Workspace"** extension. The repository name reflects the core technical component (terminal integration), while the Marketplace name describes the project's broader mission: to create an automated workspace for managing Conda environments.

------

  ## Features

  - ✅ Zero-configuration conda environment detection
  - ✅ Automatic terminal integration
  - ✅ Multi-platform support (Windows, macOS, Linux)
  - ✅ Shell auto-activation when entering project directory
  - ✅ JavaScript-based (no TypeScript compilation needed)

  ### Terminal Activation Message

  After environment activation, the terminal displays a unified single-line status message across platforms:

  ```
  🐍 Ambiente <env> attivato! : Python: <version>; Node: <version>; npm: <version>
  ```

  **Platform-specific behavior:**

  - Python is always displayed; Node and npm only appear if available in the active environment
  - macOS/Linux use ANSI colors (green for environment name; cyan for versions)
  - Windows PowerShell displays colors, while CMD uses a fallback without colors
  - Verbose `conda activate` output is suppressed on macOS/Linux to avoid duplicate messages while keeping the summary line

------

  ## Quick Start

  1. **Open the project:**

     ```bash
     code smart-conda-terminal.code-workspace
     ```

  2. **Install dependencies (if not already done):**

     ```bash
     npm install
     ```

  3. **Start development:**

     - Press `F5` to run the extension in debug mode
     - Use `Ctrl+Shift+P` and run "Developer: Reload Window" after changes

------

  ## Project Structure

  ```
  smart-conda-terminal/
  ├── vscode-extension/          # VS Code extension source
  │   ├── extension.js          # Main extension file
  │   ├── modules/              # Modular components
  │   │   ├── env.js           # Environment management
  │   │   ├── workspace.js     # Workspace configuration
  │   │   ├── shell.js         # Shell integration
  │   │   └── version.js       # Version utilities
  │   └── templates/            # Template files
  ├── scripts/                  # Utility scripts
  │   └── update-version.js     # Version management
  ├── resources/                # Icons and assets
  ├── .vscode/                  # VS Code configuration
  ├── out/                      # Build output (dev)
  ├── dist/                     # Production builds
  └── package.json              # Extension configuration
  ```

------

  ## Modular Architecture

  This extension is organized into four main modules that work together to provide a consistent and reusable workflow.

  ### Module Overview

  - **`env`**: Conda environment management (detection, selection, `environment.yml` parsing)
  - **`workspace`**: `.code-workspace` file creation and VS Code settings optimization
  - **`shell`**: Auto-activation in shell and profile management (macOS/Linux/Windows)
  - **`version`**: Project version reading/updating (delegates to external scripts)

  ### Module Details

  #### `env` Module

  - **Purpose**: Locate available environments and select the one to associate with the project
  - **Key functions**: Environment search (`conda env list`), environment inference from `environment.yml`, selection prompts
  - **I/O**: Environment name, Python interpreter path, conda metadata

  #### `workspace` Module

  - **Purpose**: Generate a minimal, portable VS Code workspace linked to the chosen environment
  - **Key functions**: `.code-workspace` file writing, recommended settings for Python/Node/Mixed projects, template integration from `vscode-extension/templates/`
  - **I/O**: Workspace file path, editor and terminal settings

  #### `shell` Module

  - **Purpose**: Configure auto-activation of the environment when entering the project directory
  - **Key functions**: Add/remove blocks in shell profiles (zsh/bash/PowerShell), fallback to `conda.sh`, backup creation
  - **Safety**: Idempotent and delimited modifications with markers; backups before writing

  #### `version` Module

  - **Purpose**: Manage project version and provide increment options (patch/minor/major)
  - **Implementation**: Utility functions in `vscode-extension/modules/version.js` (`getCurrentVersion`, `incrementVersion`); executes project script `scripts/update-version.js` to update files like `package.json`, `pyproject.toml`, `CHANGELOG.md`
  - **Related command**: "Smart Conda: Update Project Version"

  ### Module Interactions

  - `env` provides information (name/path) to `workspace` and `shell`
  - `workspace` configures VS Code to use the interpreter from `env`
  - `shell` ensures automatic environment activation when entering the project
  - `version` operates independently but reports status in extension logs

  ### Key Files

  - `vscode-extension/extension.js`: Registers commands and orchestrates modules
  - `vscode-extension/modules/version.js`: Version utilities (reusable outside `extension.js`)
  - `scripts/update-version.js`: Project-side script that applies updates
  - `vscode-extension/templates/`: Templates for workspace and settings

  ### Main Commands

  - **Smart Conda: Configure Workspace** → uses `env`, `workspace`, `shell`
  - **Smart Conda: Update Project Version** → uses `version` (delegates to project script)
  - **Smart Conda: Create New Environment** → creates a new Conda environment from template or `environment.yml`
  - **Smart Conda: Create Requirements.txt** → generates `requirements.txt` from active environment or `environment.yml`
  - **Smart Conda: Export Environment.yml** → exports environment definition to `environment.yml`

  ### UI: Explorer + Activity Bar

  - The "Smart Conda" view in Explorer is always visible when at least one workspace folder is open (`workspaceFolderCount > 0`)
  - The Activity Bar icon provides quick access without affecting Explorer section visibility
  - Removed "Show/Hide in Explorer" button from TreeView and `smartConda:explorerVisible` logic
  - TreeView exposes 5 operational actions: Configure Workspace, Update Version, Create New Environment, Create Requirements.txt, Export Environment.yml
  - Updated manifest (`vscode-extension/package.json`): Explorer view `when` condition set to `workspaceFolderCount > 0`

------

  ## Development Commands

  ```bash
  # Package the extension
  npm run package
  
  # Update version
  npm run version:patch
  npm run version:minor
  npm run version:major
  
  # Run tests
  npm test
  ```

------

  ## Shell Auto-activation

  The project is configured to automatically activate the conda environment when you enter the project directory.

  **Configuration details:**

  - Function name: `sct_dev`
  - Environment: `sct-dev`
  - Project path: `/Users/tony/Documents/PROJECTPY/smart-conda-terminal`

  **Supported shells:**

  - ZSH (`~/.zshrc`)
  - Bash (`~/.bashrc` or `~/.bash_profile`)
  - PowerShell

------

  ## Building and Packaging

  To create a VSIX package for distribution:

  ```bash
  npm run package
  ```

  This will create a `.vsix` file in the project root.

------

  ## Git Hooks for Documentation Reminders

  To automatically log dated entries in `STRUTTURA_PROGETTO.md` when key files are modified (e.g., `extension.js`, README), enable repository hooks:

  ```bash
  git config core.hooksPath .githooks
  ```

  This enables the pre-commit script that appends an entry with date/time and the list of staged files.

  **Note**: Documentation updates follow two distinct workflows:

  - **SAVEAGG**: Summary in `UPDATE_PR.MD`
  - **DOCUPDATE**: Structured append in `STRUTTURA_PROGETTO.md`

------

  ## 🤝 Contributing

  Contributions are welcome! Follow these guidelines:

  ### How to Contribute

  1. **Fork** the repository
  2. **Create a branch** for your feature (`git checkout -b feature/NewFeature`)
  3. **Commit** your changes (`git commit -m 'Add NewFeature'`)
  4. **Push** to the branch (`git push origin feature/NewFeature`)
  5. **Open a Pull Request**

------

  ## 📞 Contact

  - **Developer**: [Antonio DEM](https://github.com/AntonioDEM)
  - **GitHub Issues**: [Report issues](https://github.com/AntonioDemarcus/smart-conda-terminal/issues)
  - **Pull Requests**: [Contribute](https://github.com/AntonioDemarcus/smart-conda-terminal/pulls)

------

  ## 📄 License

  This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

------

  ## Project Information

  **Project Path:** /Users/tony/Documents/PROJECTPY/smart-conda-terminal
  **Created:** Sat Sep 27 2025 08:28:49 CEST
  **Last Update:** Fri Oct 10 2025 08:28:49 CEST
  **User:** tony
  **Environment:** sct-dev
