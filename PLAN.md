# Mintzy Plugin Desktop App — Build Plan

## Overview

Native Windows Electron wrapper for the Mintzy Plugin terminal. Loads the real Plugin website at `https://www.mintzy.in/plugin/sessions` in a hardened `BrowserWindow` after API-key authentication. Broker type is embedded in the API key (set during key generation) and auto-applied via `?broker=` URL param — no broker dropdown in the desktop flow.

**Repo**: `github.com/Mintzy-V1/Plugin-App-Desktop`
**Branch strategy**: `main` (scaffold only) ← PRs from `dev-anubhav` (all work)
**Distribution**: Windows 64-bit only, NSIS per-user installer, unsigned

---

## Confirmed Architecture

### Plugin URL
`https://www.mintzy.in/plugin/sessions` — direct Next.js page, not an iframe.

### Website Auth Mechanism
- **Token storage**: `localStorage` key `mintzy_token` (JWT)
- **Auth validation**: `AuthContext` reads token on mount → calls `GET /api/auth/me`
- **Token refresh**: 401 → axios interceptor calls `POST /api/auth/refresh` → httpOnly `refreshToken` cookie → new JWT
- **Access token expiry**: 7 minutes
- **Refresh token expiry**: 7 days (httpOnly cookie, set by backend)

### Desktop App Auth Flow
1. User generates API key on website (picks broker type at generation time)
2. Desktop app exchanges API key for JWT tokens via new backend endpoint
3. Desktop app sets refresh token as httpOnly cookie via Electron `session.cookies.set()`
4. Desktop app injects JWT into `localStorage.mintzy_token` + appends `?broker=` to URL
5. Website's built-in refresh mechanism handles mid-session 401s automatically

### Broker Type Handling
- Stored on the `tradingApiKey` model (new field)
- Returned by exchange endpoint alongside tokens
- Desktop app passes via URL: `/plugin/sessions?broker=angel`
- Frontend reads param, hides dropdown in `ConnectBrokerForm`
- `ConnectBrokerForm` still requires credential entry (API key, client code, password)

---

## Phases

### Phase 1 — Setup, Repo, Auth Foundation (Days 1–3)

#### Done
- [x] Create `main` branch with scaffold commit (README, .gitignore, base package.json)
- [x] Create `dev-anubhav` branch, push both to origin
- [x] Create PLAN.md, PROGRESS.md, HANDOFF.md
- [x] Install Electron + electron-builder + dependencies
- [x] Configure electron-builder.yml (NSIS, per-user, Windows 64-bit)
- [x] Hardened BrowserWindow (contextIsolation, sandbox, no nodeIntegration)
- [x] Preload script with contextBridge (auth, navigation, window, system channels)
- [x] Window state persistence service (1440x900 default, JSON in userData)
- [x] Auth service (mocked — 3 error modes: invalid/expired/broker-expired)
- [x] Storage service (safeStorage DPAPI encryption, base64 fallback)
- [x] Login screen HTML/CSS/JS (dark Mintzy theme, API key input, error display)
- [x] Error/retry screen (distinct messages for network vs broker expiry)
- [x] IPC wiring (login form → main process → auth result → terminal redirect)
- [x] Plugin terminal loading with localStorage token injection

#### 1.3 — Terminal Loading Spike
- [ ] Append `?broker=` query param from auth response
- [ ] Set refresh token as httpOnly cookie via `session.cookies.set()`
- [ ] Test against real Plugin URL (blocked on exchange endpoint)

### Phase 2 — Core Wrapper & Session Handling (Days 4–7)

#### 2.1 — Session Persistence & Silent Revalidation
- On relaunch: decrypt stored API key, exchange for fresh tokens
- Valid → skip login, load terminal directly
- Invalid/expired/revoked → show login screen with message
- Logout clears all stored credentials

#### 2.2 — Two Distinct Error Paths
- API key invalid/expired/revoked → login screen with message
- Broker session expired → distinct message with broker login instruction

#### 2.3 — Window State Persistence (done in Phase 1.1)

#### 2.4 — Offline/Error Retry Screen (done in Phase 1.2)

### Phase 3 — Native Features & Edge Cases (Days 8–10)

#### 3.1 — Tray Icon
- Minimize to tray on close
- Tray menu: Open Mintzy, Logout, Quit

#### 3.2 — Auto-Launch
- Toggle via `app.setLoginItemSettings`, default off

#### 3.3 — Sleep/Resume
- `powerMonitor.on('resume')` → trigger reconnect check

#### 3.4 — Notifications
- Hook into backend websocket/event channel (if available)

#### 3.5 — Uninstall/Reinstall Clean-State Test

### Phase 4 — Real Auth Integration & Build (Days 11–13)

#### 4.1 — Swap Mocked Auth for Real Endpoint
- Replace `auth.js` mock with real `POST /api/auth/exchange-api-key` call

#### 4.2 — Full Integration Test

#### 4.3 — electron-builder Installer Build

#### 4.4 — Buffer

---

## Required Changes Outside Desktop App

### Backend (`mintzy-backend-new`)
| Change | Details |
|--------|---------|
| Add `brokerType` to `tradingApiKey` model | `{ type: String, enum: ['angel', 'tradex'], required: true }` |
| Accept `brokerType` in key generation | `POST /api/plugin-keys/generate` body: `{ name, brokerType }` |
| New: `POST /api/auth/exchange-api-key` | Takes `{ apiKey }` → validates → returns `{ accessToken, refreshToken, brokerType }` |

### Frontend (`mintzy-frontend-repo`)
| Change | Details |
|--------|---------|
| API key management UI | Account Settings → API Keys → Generate (with broker type selector) |
| `ConnectBrokerForm` | Accept `initialBrokerType` prop → hide dropdown if set |
| `plugin/sessions/page.tsx` | Read `?broker=` query param, pass to `ConnectBrokerForm` |

See `MINTZY_DESKTOP_APP_PLAN.pdf` for full API contracts, data flow diagrams, and timeline.

---

## Out of Scope (v1)

- Auto-update mechanism
- Code signing
- macOS/Linux builds
- Custom notification action buttons
- Any UI diverging from existing website terminal
- Corporate/locked-down Windows (unsigned installer block)
- Any product other than Plugin
