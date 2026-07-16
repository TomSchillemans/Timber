# Timber

A cross-platform desktop app for browsing local log files: searchable,
readable, presented well. Built with **Rust + Tauri 2** and a
**React + TypeScript + Vite** frontend.

> Status: initial scaffold. No log-reading logic yet.

## Stack

| Concern  | Choice                                  |
| -------- | ---------------------------------------- |
| Shell/UI | Tauri 2 + React 19 + TypeScript + Vite   |
| Backend  | Rust (`src-tauri/`)                      |

## Requirements

- Node.js **20.19+** or **22.12+** (see `.nvmrc`)
- Rust (stable) via [rustup](https://rustup.rs)

## Development

```
npm install
npm run tauri dev    # run the app with hot reload
npm run build         # typecheck + build the frontend
npm run tauri build   # production bundle
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
