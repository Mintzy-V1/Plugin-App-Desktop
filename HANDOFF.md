# Mintzy Plugin Desktop App — Handoff Notes

## Purpose
This file captures context for anyone picking up this build mid-stream — blockers, decisions, pending coordination items, and architectural rationale.

---

## Current Status (July 16, 2026)

**Phase 1.1 and 1.2 complete.** Repo scaffolded, Electron app built with hardened BrowserWindow, native login screen, mocked auth, error screens, and localStorage token injection. Phase 1.3 (terminal loading spike, broker param, cookie setting) ready to start.

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

## Critical Blockers (Must Resolve Before Phase 4)

### 1. API-Key Exchange Endpoint (Backend Team)
`POST /api/auth/exchange-api-key` — takes `{ apiKey }`, returns `{ accessToken, refreshToken, brokerType }`. Does not exist yet. See `MINTZY_DESKTOP_APP_PLAN.pdf` for full contract.

### 2. Add brokerType to tradingApiKey Model (Backend Team)
The `tradingApiKey` model needs a `brokerType` enum field. Key generation endpoint needs to accept it.

### 3. API Key Management UI (Frontend Team)
Account Settings page where logged-in users can generate API keys with broker type selection.

### 4. ConnectBrokerForm Changes (Frontend Team)
Accept `initialBrokerType` prop, hide dropdown when set. Read `?broker=` from URL.

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
