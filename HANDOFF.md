# Mintzy Plugin Desktop App — Handoff Notes

## Purpose
This file captures context for anyone picking up this build mid-stream — blockers, decisions, pending coordination items, and architectural rationale.

---

## Current Status (July 17, 2026)

**All 4 phases complete.** Full Electron desktop app with hardened BrowserWindow, native login screen, real/mocked auth, error screens, localStorage token injection, tray icon, auto-launch, notifications, sleep/resume handling, and NSIS build pipeline. See `PROGRESS.md` for detailed checklist.

### What's Implemented

| Feature | Status |
|---------|--------|
| Hardened BrowserWindow (contextIsolation, sandbox, no nodeIntegration) | ✅ |
| Preload with contextBridge (auth, nav, window, system) | ✅ |
| Window state persistence (1440x900 default) | ✅ |
| safeStorage credential encryption (DPAPI + base64 fallback) | ✅ |
| Native login screen (dark Mintzy theme, API key input, error display) | ✅ |
| Error/retry screen (network vs broker expiry distinction) | ✅ |
| Plugin terminal loading with `?broker=` param + localStorage token injection | ✅ |
| httpOnly refresh cookie set via `session.cookies.set()` | ✅ |
| Mocked auth service (3 error modes: invalid/expired/broker-expired) | ✅ |
| Silent session revalidation on relaunch | ✅ |
| Single-instance lock | ✅ |
| Tray icon + minimize to tray | ✅ |
| Tray menu: Open, Launch at startup, Logout, Quit | ✅ |
| Auto-launch toggle (Windows startup) | ✅ |
| Sleep/resume reconnect | ✅ |
| Notifications (click-to-focus) | ✅ |
| Real auth HTTP client (`api.js` with `net.request`, mock fallback in dev) | ✅ |
| NSIS build pipeline with auto-generated 256x256 icon | ✅ |
| Dev mock: `sk_trade_mock_valid_key_12345` | ✅ |

---

## Resolved Questions (from Repo Inspection)

| Question | Answer |
|----------|--------|
| Plugin URL | `https://www.mintzy.in/plugin/sessions` |
| Auth token storage | `localStorage` key `mintzy_token` (JWT) |
| Auth mechanism | `AuthContext` reads token → `GET /api/auth/me` |
| Token refresh | 401 → `POST /api/auth/refresh` → httpOnly `refreshToken` cookie |
| Access token expiry | 7 minutes |
| Refresh token expiry | 7 days |
| Broker context | User selects in `ConnectBrokerForm` dropdown (angel/tradex) |
| API key system | Exists at `/api/plugin-keys/generate` → `sk_trade_*` keys, stored hashed |
| Plugin terminal | Direct Next.js page (not iframe), `"use client"` component |
| Auth middleware | `authMiddleware` (JWT only), `pluginAuthMiddleware` (JWT + API key) |

---

## Dependencies (External Teams)

### Backend (`mintzy-backend-new`)
- `POST /api/auth/exchange-api-key` endpoint — see `MINTZY_DESKTOP_APP_PLAN.pdf` for contract
- `brokerType` field on `tradingApiKey` model
- Update key generation to accept `brokerType`

### Frontend (`mintzy-frontend-repo`)
- API key management UI (Account Settings → API Keys)
- `ConnectBrokerForm` — accept `initialBrokerType` prop, hide dropdown when set
- `plugin/sessions/page.tsx` — read `?broker=` param, pass to `ConnectBrokerForm`

**Desktop app will auto-detect the real endpoint** when these are deployed. Set `MINTZY_API_URL` env var or remove dev mock to test against production. See `api.js` for the HTTP client.

---

## Architectural Decisions

### Why safeStorage over alternatives
OS-level encryption (DPAPI on Windows), no master password needed.

### Why localStorage injection for auth
The website's AuthContext reads the token from `localStorage`. Setting it via `executeJavaScript` matches the existing mechanism exactly — no new auth flow invented.

### Why `?broker=` URL param for broker type
Simplest way to pass broker context to the web page. No localStorage coordination, no new APIs. The frontend reads it from `window.location.search` once on mount.

### Why httpOnly cookie for refresh token
The website's axios interceptor handles 401s via `POST /api/auth/refresh` which sends the httpOnly cookie automatically. Setting this cookie via Electron's `session.cookies.set()` allows the built-in refresh mechanism to work without any desktop app code.

### Why single-instance lock
A live trading session should never have two instances against the same account.

### Why unsigned installer for v1
Code-signing cert takes time. MVP ships unsigned with documented SmartScreen warning.

---

## Complete Data Flow

See `MINTZY_DESKTOP_APP_PLAN.pdf` for:
- Full auth flow diagrams (generation → login → token refresh)
- API contracts for the exchange endpoint
- Desktop app architecture diagram
- Timeline

---

## Open Items for Team Discussion

1. Exchange endpoint URL — `POST /api/auth/exchange-api-key` or different path?
2. Broker type values — only `angel` and `tradex`, or more planned?
3. Should API keys be generatable for multiple brokers per user?
4. WebSocket/event channel for trade notifications — exists or planned?
5. Hosting for final .exe — GitHub Releases or S3/CDN?
6. Exact Mintzy logo/branding assets — who provides them?

---

## Security Notes

- API key never appears in logs or console output
- All credential storage uses safeStorage encryption — never plaintext
- Preload script is minimal — only exposes what login/error screens need
- contextIsolation, nodeIntegration: false, sandbox: true are non-negotiable
- DevTools disabled in production builds
