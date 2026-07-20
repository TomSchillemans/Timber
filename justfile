# Timber - Tauri + React log viewer
#
# Common commands:
#   just install  - Install dependencies
#   just dev      - Run the full Tauri app (frontend + backend)
#   just test     - Run frontend unit tests
#   just build    - Build the frontend
#
# See 'just --list' for all available commands, including the Rust
# backend recipes nested under the `tauri` module (`just tauri::<recipe>`).

mod tauri 'src-tauri/justfile'

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
test PATH="src/**/*.test.{ts,tsx}":
    npx vitest run {{PATH}}

# Run all tests (frontend + backend)
test-full: test tauri::test

# Build the frontend for production
build:
    npm run build
