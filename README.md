# Mintzy Plugin Desktop App

Native Windows desktop wrapper for the Mintzy Plugin terminal. Single-instance Electron app with encrypted credential storage, system tray integration, and auto-launch support.

## Prerequisites

- Node.js 18+
- npm 9+

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `release/Mintzy Plugin Setup *.exe`

## Tech Stack

- Electron 28+
- electron-builder (NSIS, per-user install)
- safeStorage (Windows DPAPI) for credential encryption

## Architecture

The app loads the real Mintzy Plugin terminal in a hardened BrowserWindow after authenticating via API key. No UI is rebuilt — native UI is limited to: login screen, tray menu, error screens.

## Security

- contextIsolation: true
- nodeIntegration: false
- sandbox: true
- No remote module
- Minimal preload with contextBridge

See [Build Instructions](./BUILD.md) for full details.
