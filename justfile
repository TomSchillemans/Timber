# Timber - Tauri + React log viewer
#
# Common commands:
#   just install  - Install dependencies
#   just dev      - Run the full Tauri app (frontend + backend)
#   just test     - Run frontend unit tests
#   just build    - Build the frontend
#
# See 'just --list' for all available commands, including src-tauri/justfile
# (run `just -f src-tauri/justfile` or `cd src-tauri && just` for Rust-only recipes).

# Show available commands
default:
    @just --list

# Install dependencies
install:
    npm install

# Run the Tauri app in development mode (frontend + backend)
dev:
    npm run tauri dev

# Run frontend unit tests (optionally specify a path)
test PATH="src/**/*.test.tsx":
    npx vitest run {{PATH}}

# Run backend (Rust) unit tests
test-rust:
    just -f src-tauri/justfile test

# Run all tests (frontend + backend)
test-full: test test-rust

# Build the frontend for production
build:
    npm run build

# Build the Rust backend
build-rust:
    just -f src-tauri/justfile build

# Lint the Rust backend (no frontend linter configured yet)
lint:
    just -f src-tauri/justfile lint

# Format the Rust backend (no frontend formatter configured yet)
format:
    just -f src-tauri/justfile format
