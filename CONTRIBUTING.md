# Contributing to filerouter-cli

Thanks for your interest in contributing! This document covers how to set up the project for development and submit changes.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

## Setup

```bash
# Clone the repository
git clone https://github.com/artsiomshaitar/filerouter-cli.git
cd filerouter-cli

# Install dependencies
bun install
```

## Project Structure

This is a monorepo with Bun workspaces:

```
packages/filerouter-cli/   # The main library
  src/                     # Source code
    cli/                   # CLI tool (filerouter-cli binary)
    generator/             # Code generation subsystem
    __tests__/             # Test suite
  build.ts                 # Custom build script
example/                   # Example CLI application
```

## Development

```bash
# Run tests
bun run test

# Run tests in watch mode
bun test --watch --cwd packages/filerouter-cli

# Type check
bun run typecheck

# Build
bun run build

# Lint (Biome)
bun run lint

# Lint and auto-fix
bun run lint:fix

# Format
bun run format
```

## Making Changes

1. Create a branch from `main`.
2. Make your changes.
3. Ensure tests pass: `bun run test`
4. Ensure types pass: `bun run typecheck`
5. Ensure lint passes: `bun run lint`
6. Submit a pull request.

## Code Style

- This project uses [Biome](https://biomejs.dev) for linting and formatting.
- Run `bun run lint:fix` before committing to auto-fix issues.
- Avoid comments that restate what the code already says. Comment the *why*, not the *what*.

## Testing

Tests use Bun's built-in test runner. Test files live alongside source code in `__tests__/` directories.

```bash
# Run all tests
bun run test

# Run a specific test file
bun test packages/filerouter-cli/src/__tests__/router.test.ts
```

## Architecture

- **Core library** (`src/*.ts`) — the public API. No dependencies on CLI or generator modules.
- **Generator** (`src/generator/`) — scans command files, generates `commandsTree.gen.ts`. Self-contained.
- **CLI tool** (`src/cli/`) — the `filerouter-cli` binary. Depends on the generator.

The dependency flow is: CLI -> Generator -> Core. Never the reverse.
