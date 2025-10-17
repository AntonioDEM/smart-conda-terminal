# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2025-10-17

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements


## [2.0.1] - 2025-10-17

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements


## [2.0.0] - 2025-10-16

### Added
- Script di sincronizzazione per packaging: `scripts/sync-release.sh` (copie selettive per VSIX e documentazione)
- Documentazione estesa su UI "Explorer + Activity Bar" in `README.md` (root) e `vscode-extension/README.md`
- Comandi documentati: "Create New Environment", "Create Requirements.txt", "Export Environment.yml"

### Changed
- Explorer: vista "Smart Conda" sempre visibile con workspace aperto (`workspaceFolderCount > 0`)
- Rimosso pulsante "Mostra/Nascondi in Explorer" e il context key `smartConda:explorerVisible`
- L'icona della Activity Bar non forza il focus sull'Explorer
- Aggiornato `vscode-extension/package.json` (condizioni `when`) e pulizia di `extension.js`
- Allineata la documentazione del pacchetto VS Code con i nuovi comandi e la gestione UI

### Fixed
- Eliminato flicker e incongruenze di visibilità dovute al focus forzato dell'Explorer
- Rimossi riferimenti orfani a `toggleExplorerVisibility` e al context key `smartConda:explorerVisible`

### Security
- N/A

## [1.0.7] - 2025-09-29

### Added
- TreeView consolidata con 5 azioni: Configure Workspace, Update Version, Create New Environment, Create Requirements.txt, Export Environment.yml

### Changed
- Explorer: vista "Smart Conda" sempre visibile quando il workspace è aperto (`workspaceFolderCount > 0`)
- Rimosso il pulsante "Mostra/Nascondi in Explorer" e la logica del context key `smartConda:explorerVisible`
- L'icona della Activity Bar non forza il focus sull'Explorer
- Pulizia di `vscode-extension/extension.js` e aggiornamento del manifest `vscode-extension/package.json` (condizione `when`)

### Fixed
- Eliminato il flicker e le incongruenze di visibilità dovute al focus forzato dell'Explorer
- Rimossi riferimenti orfani a `toggleExplorerVisibility` e al context key `smartConda:explorerVisible`

### Security
- N/A


## [1.0.6] - 2025-09-29

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements


## [1.0.5] - 2025-09-29

### Added
- TODO: Document new features

### Changed
- TODO: Document changes

### Fixed
- TODO: Document bug fixes

### Security
- TODO: Document security improvements


## [1.0.4] - 2025-09-29

### Added
- Complete version management system
- Support for multiple file formats (package.json, environment.yml, pyproject.toml)
- VS Code extension package.json synchronization

### Changed
- Improved update-version.js script
- Better error handling and validation

### Fixed
- CHANGELOG duplicate entries
- Version synchronization across all project files

## [1.0.0] - 2025-09-27

### Added
- Initial project structure for VS Code extension
- Automated conda environment detection and setup
- Shell integration for auto-activation
- Version management script
- VS Code workspace configuration
- Cross-platform support (macOS, Linux, Windows)

### Technical
- JavaScript implementation
- Simplified build process
- Automated dependency installation
- Environment: sct-dev
