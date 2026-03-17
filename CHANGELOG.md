# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `router.run()` no longer calls `process.exit()`. It re-throws errors after printing them. Use `.catch(() => process.exit(1))` in your entry point.
- Removed `$` and `getShell()` from the public API. Use `Bun.$` directly.
- Removed `isRunCommand()` from the public API.
- Reduced public API surface — internal parser, help, and generator utilities are no longer exported from the main entry point.
- `MiddlewareError` now sets standard `Error.cause` property.

### Added

- `toError()` internal utility for safe error coercion in catch blocks.
- `extractRouteParams()` shared utility for route path param extraction.
- `findNearestPackageJson()` shared utility for package.json traversal.
- `runCommand` cycle detection — prevents infinite redirect loops (A -> B -> A) and caps redirect depth at 10.
- Biome for linting and formatting.
- `.editorconfig` for cross-editor consistency.
- Lefthook for pre-commit linting.
- `CONTRIBUTING.md` with development setup instructions.
- Dependabot configuration for automated dependency updates.

### Fixed

- `shell.ts` no longer crashes at import time in non-Bun environments (removed eager module-level `getShell()` call).
- `build.ts` no longer references non-existent `src/utils/aliases.ts`.
- All `error as Error` unsafe casts replaced with safe `toError()` coercion.
- Previously skipped `runCommand` loop prevention test is now enabled and passing.

### Removed

- Duplicate `FieldInfo` interface in `help.ts` (now imported from `types.ts`).
- Duplicate param extraction implementations in `runCommand.ts` and `codegen.ts`.
- Duplicate CLI-string building implementations in `help.ts` and `commandInfo.ts`.
- Duplicate package.json traversal in `version.ts`.
- ~60 restating comments that added no value beyond what the code already expressed.
- `getRegisteredCliName()` — exported but never used.

## [0.1.0-alpha.1] - 2024-12-01

### Added

- Initial alpha release.
- File-based routing for CLI applications.
- TypeScript-first with full type inference.
- Zod validation for arguments and parameters.
- Middleware and layout support.
- Splat routes.
- Code generation from file structure.
- Interactive dev mode with Ink/React TUI.
- Shell completion scripts (bash, zsh, fish).
