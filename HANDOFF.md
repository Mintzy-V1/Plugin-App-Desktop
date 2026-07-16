# Mintzy Plugin Desktop App — Handoff Notes

## Purpose
This file captures context for anyone picking up this build mid-stream — blockers, decisions, pending coordination items, and architectural rationale.

---

## Current Status (July 16, 2026)

**Phase 1 in progress.** Repo scaffolded on `main`, all development on `dev-anubhav`. Electron app being built from scratch. See `PROGRESS.md` for live status.

---

## Critical Blockers (Must Resolve Before Phase 4)

### 1. API-Key Login Endpoint (Backend Team)
The backend endpoint (key in → session token + broker type out) is **not yet implemented**. All Phases 1–3 build against a mocked response. Phase 4 requires:
- The real endpoint URL and method
- Exact request/response schema
- Error code schema (invalid key, expired key, revoked key, broker expired)

**Action**: Coordinate with backend team ASAP to lock down the schema, even if endpoint isn't live.

### 2. "Generate API Key" Feature (Website)
The desktop app depends on users being able to generate an API key from their account settings on the website. If this isn't being built in parallel by the website team, escalate.

### 3. Session/Broker Injection Mechanism
Need to confirm from `mintzy-frontend-repo` exactly how the website passes session context and broker type into the Plugin terminal (cookie? localStorage? URL param?). The desktop app must replicate the exact same mechanism, not invent a new one.

---

## Architectural Decisions

### Why safeStorage over alternatives
- `safeStorage` uses OS-level encryption (DPAPI on Windows)
- No master password needed — tied to Windows user account
- Keys are automatically scoped to the machine + user
- Store only under `app.getPath('userData')` — safeStorage handles encryption

### Why no custom UI for the terminal
- The Plugin website already has a full-featured terminal UI
- Rebuilding it would duplicate effort and diverge from the real product
- Loading the real site in a sandboxed BrowserWindow ensures feature parity automatically
- Security: sandbox prevents compromised web content from accessing Node.js

### Why single-instance lock
- A live trading session should never have two instances running against the same account
- `app.requestSingleInstanceLock()` is the canonical Electron pattern
- Second launch → focuses existing window

### Why unsigned installer is acceptable for v1
- Code-signing certs take time and money to procure
- MVP ships without; SmartScreen warning is documented and expected
- Building unsigned now doesn't prevent signing later — the installer structure is identical

### Why no auto-update in v1
- `electron-updater` requires code signing for Windows (otherwise SmartScreen flags even harder)
- Manual download from GitHub Releases is sufficient for MVP
- Auto-update can be added in Phase 2 once signing is in place

---

## Questions Raised (Not Guessed — Flagged for Team)

1. What is the exact API-key login endpoint signature? (backend team)
2. What field/format carries broker type in the auth response? (backend team) — Note: API keys in `tradingApiKey` model don't store broker type. Is this being added?
3. Does a verify/me endpoint exist for silent relaunch validation? (backend team)
4. What error codes exist for: invalid key vs expired key vs broker session expired? (backend team)
5. Does a websocket/event channel exist for trade/hedge notifications? (backend team)
6. Is "Generate API Key" being built on the website? (founder/website team)
7. Where should the final .exe be hosted? GitHub Releases vs S3/CDN? (founder/backend team)
8. Exact Mintzy logo/branding assets — who provides them? (founder/design)

## Findings from Repo Inspection — Resolved Questions

### Plugin URL (Confirmed)
- **Page**: `https://www.mintzy.in/plugin/sessions`
- Next.js client component using `useAuth()` from AuthContext
- No iframes — it's a direct page load

### Session Injection Mechanism (Confirmed)
- Token stored in **`localStorage` key `mintzy_token`** (JWT from Google OAuth)
- AuthContext reads it on mount, calls `GET /api/auth/me` to validate
- API requests use `Authorization: Bearer <token>` header (via axios interceptor)
- Desktop app will: load URL → `executeJavaScript` to set `localStorage.mintzy_token` → reload page

### API Key System (Confirmed — Already Exists)
- Endpoints at `/api/plugin-keys/generate`, `/api/plugin-keys/list`, `/api/plugin-keys/revoke/:keyId`
- Keys are `sk_trade_` + 64 hex chars, stored **SHA-256 hashed**
- `pluginAuthMiddleware` accepts both JWT and `sk_trade_*` keys as Bearer tokens
- Controller: `tradingApiKeyController.js`

### Backend Auth Middleware (Confirmed)
- `authMiddleware`: JWT only (from `Authorization: Bearer`)
- `pluginAuthMiddleware`: JWT OR API key (`sk_trade_*` in `Authorization: Bearer`)
- Both attach `req.user = { userId }` to request

### Error Response Format (Confirmed)
```json
{
  "status": "fail"|"error",
  "message": "<message>"
}
```
Or for auth middleware errors:
```json
{
  "success": false,
  "message": "Access token required" | "User not found or inactive" | "Invalid token" | "Token expired"
}
```

### Missing: API Key → JWT Exchange Endpoint
The missing piece is an endpoint that:
1. Takes `sk_trade_*` API key (via body or header)
2. Validates against `tradingApiKey` model (hash + lookup)
3. Finds the user
4. Returns a JWT (same format as Google OAuth token) + broker type
5. This JWT is what we inject into `localStorage.mintzy_token`

This endpoint does not exist yet — being built by backend team.

---

## Security Notes

- **Passwords/API keys must never appear in logs or console output**
- All credential storage uses `safeStorage` encryption — never plaintext
- Preload script is minimal — only expose what login/error screens need
- `contextIsolation`, `nodeIntegration: false`, `sandbox: true` are non-negotiable
- DevTools disabled in production builds

## Contact / Escalation

- **Build lead**: Anubhav (current implementer)
- **Backend coordination**: [name] — responsible for API-key endpoint
- **Website coordination**: [name] — responsible for Generate API Key UI
- **Founder**: [name] — final decisions on hosting, branding

*(Fill in names as team assigns owners)*
