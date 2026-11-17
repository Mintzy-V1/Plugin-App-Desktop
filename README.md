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

## Admin mode

Press **Ctrl+Shift+A** on the login screen to sign in with an admin key (or the master key) instead of an API key. Admin mode shows every account's live sessions, trades and P&L, served by the gateway's `/api/v1/admin` API, which enforces all access and audit-logs every view. On a running session an admin can also **Stop session** or **Exit position**, but only by entering that account's own Mintzy API key, which the gateway checks against the session's owner (the key is never saved). The master key also manages per-admin keys and reads the audit log.

The admin token is kept in memory and `sessionStorage` only (cleared when the app closes), separate from the user token. See `docs/API.md` in `mintzy-api-gateway` for key setup.

## Security

- contextIsolation: true
- nodeIntegration: false
- sandbox: true
- No remote module
- Minimal preload with contextBridge

See [Build Instructions](./BUILD.md) for full details.
