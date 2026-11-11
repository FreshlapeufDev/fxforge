# Changelog

All notable changes to fxforge are listed here. Versions follow [Semantic Versioning](https://semver.org).

## 1.1.0

### Added
- FreshDev logo at the top of every command, with a colour gradient in modern terminals.
- `--no-banner` to hide the logo, for scripts and CI logs.
- French documentation: `README.fr.md`.
- Badges, requirements and a command overview in the README.
- `FORCE_COLOR` support, to keep colours when the output is piped.

### Fixed
- The npm page now links to the GitHub repository, issues and homepage.

## 1.0.1

### Changed
- Line endings are normalised to LF on every platform.

## 1.0.0

### Added
- `fxforge create`: scaffold a resource for Standalone, ESX Legacy, QBCore or Qbox, with an optional HTML or Vite + TypeScript NUI.
- `fxforge check`: lint `fxmanifest.lua` against the files on disk (17 checks).
- `fxforge pack`: build a release zip with only the files the manifest loads.
- `fxforge add`: add client, server and shared scripts, locales or a NUI.

