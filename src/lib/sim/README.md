# Simulation Engine

Pure TypeScript turn-based simulation engine for Infinite Conflict.

## Architecture

- **engine/** - Core simulation logic (framework-free)
- **rules/** - Game constants and turn order
- **defs/** - Item definitions and data adapters

## Principles

- **Framework-free**: No React/Next/DOM dependencies
- **Deterministic**: Same inputs always produce same outputs
- **Immutable operations**: Clone state for modifications
- **Pure functions**: No side effects

## Testing

All engine code must have ≥90% test coverage.
Tests located in `src/lib/sim/engine/__tests__/`
