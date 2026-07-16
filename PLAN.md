# Mintzy Plugin Desktop App — Build Plan

## Overview

Native Windows Electron wrapper for the Mintzy Plugin terminal. Loads the real Plugin website in a hardened `BrowserWindow` after API-key authentication. Custom UI is limited to: login screen, tray menu, error/offline screens.

**Repo**: `github.com/Mintzy-V1/Plugin-App-Desktop`  
**Branch strategy**: `main` (scaffold only) ← PRs from `dev-anubhav` (all work)  
**Distribution**: Windows 64-bit only, NSIS per-user installer, unsigned  

---

## Phase 1 — Setup, Repo, Auth Foundation (Days 1–3)

### Done
- [x] Create `main` branch with scaffold commit (README, .gitignore, base package.json)
- [x] Create `dev-anubhav` branch, push both to origin
- [x] Create PLAN.md, PROGRESS.md, HANDOFF.md

### 1.1 — Scaffold Electron App
- Install dependencies: `electron`, `electron-builder`, `electron-store`, `auto-launch`
- Configure `electron-builder.yml` (NSIS, per-user, Windows 64-bit)
- Write hardened `BrowserWindow` in `main.js`:
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
  - No `remote` module
  - Single-instance lock via `app.requestSingleInstanceLock()`
  - `powerMonitor.on('resume')` listener (placeholder)
- Write minimal `preload.js` with `contextBridge` exposing only `auth`, `navigation`, `window` channels
- Write `window-state.js` for size/position persistence

### 1.2 — Native Login Screen + Mocked Auth
- Write `auth.js`: mocked `login(apiKey)` returning `{ token, brokerType }` or error
- Write `storage.js`: `safeStorage.encryptString/decryptString` wrapper, store in `userData`
- Build `login.html/css/js`: single API key input, submit button, loading spinner, error display
- Wire IPC: renderer sends `auth:login` → main validates → returns result → renderer shows terminal or error
- Login screen shown at startup if no credentials stored

### 1.3 — Plugin Terminal Loading Spike
- After auth, load Plugin URL in main BrowserWindow
- Inject session context (cookie/localStorage/URL param — match website's mechanism)
- Handle load failure (offline/backend down → error screen)

---

## Phase 2 — Core Wrapper & Session Handling (Days 4–7)

### 2.1 — Session Persistence & Silent Revalidation
- On relaunch: decrypt stored token, check validity (mocked)
- Valid → skip login, load terminal directly
- Invalid/expired → show login screen with message
- Logout clears all stored credentials

### 2.2 — Two Distinct Error Paths
- API key invalid/expired/revoked → login screen with message
- Broker session expired → distinct message with broker login instruction
- Both simulated with mocked responses

### 2.3 — Window State Persistence
- Save/restore window bounds via JSON file in `userData`
- `electron-store` or manual JSON

### 2.4 — Offline/Error Retry Screen
- Native `error.html/css/js` with retry button
- Shown when terminal fails to load (no internet, backend down)

---

## Phase 3 — Native Features & Edge Cases (Days 8–10)

### 3.1 — Tray Icon
- Minimize to tray on close
- Tray menu: Open Mintzy, Logout, Quit

### 3.2 — Auto-Launch
- Toggle via `app.setLoginItemSettings`, default off
- Persist preference in settings store

### 3.3 — Sleep/Resume
- `powerMonitor.on('resume')` → trigger reconnect check
- Refresh terminal state if websocket disconnected

### 3.4 — Notifications
- Hook into backend websocket/event channel for trade/hedge events
- Native Windows `Notification` API
- If channel unavailable → stub, flag as Phase 2 dependency

### 3.5 — Uninstall/Reinstall Clean-State Test
- Verify no orphaned encrypted files after uninstall
- Fresh install → clean login prompt

---

## Phase 4 — Real Auth Integration & Build (Days 11–13)

### 4.1 — Swap Mocked Auth for Real Endpoint
- Replace `auth.js` mock with real API call
- Match exact request/response schema agreed with backend in Phase 1
- Swap URL, validation logic; keep storage, UI, error handling identical

### 4.2 — Full Integration Test
- Real API key login → correct broker type auto-applied
- All error paths with real responses

### 4.3 — electron-builder Installer Build
- Apply Mintzy branding assets (logo, icon)
- NSIS per-user installer
- Output: `release/Mintzy Plugin Setup 1.0.0.exe`

### 4.4 — Buffer
- Handle breakage from real-auth swap
- Final polish

---

## Testing (1.5 weeks post-Phase 4)

See PROGRESS.md for the full checklist. Key items:
- Fresh install on clean Win 10/11
- Real API key → broker auto-applied
- Invalid/expired key → clear error
- Relaunch → skips login
- Broker expiry → distinct message
- Close → tray, Quit → full exit
- Double-launch → focus existing
- Auto-launch → survives restart
- Sleep/resume → reconnects
- Network drop → retry screen
- Window size/position remembered
- Clean uninstall → no orphaned state
- AV false-positive check
- Read-only access respected — no backend/website repos modified

---

## Out of Scope (v1)

- Auto-update mechanism
- Code signing
- macOS/Linux builds
- Custom notification action buttons
- Any UI diverging from existing website terminal
- Corporate/locked-down Windows (unsigned installer block)
- Any product other than Plugin

---

## Backend Dependencies to Confirm (Blockers if Missing)

1. **API-key login endpoint** — not yet built, being developed by backend team
2. **"Generate API Key" UI on website** — must exist for users to create keys
3. **Error code schema** — distinct codes for invalid-key vs broker-expired
4. **Broker type field** — exact field name and values in auth response
5. **Session injection mechanism** — how website passes session/broker to terminal
6. **Verify/me endpoint** — for silent relaunch validation
7. **Websocket/event channel** — for live notifications (Phase 2 feature)
