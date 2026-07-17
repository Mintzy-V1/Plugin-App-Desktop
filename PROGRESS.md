# Mintzy Plugin Desktop App — Progress Log

## Tracking
- **Build start**: July 16, 2026
- **Target**: 2.5 weeks (12–13 working days)
- **Phase scope**: MVP — Plugin product only, Windows 64-bit, unsigned NSIS installer

---

## Phase 1 — Setup, Repo, Auth Foundation (Days 1–3)

### Day 1 — July 16

#### Completed
| Item | Status | Notes |
|------|--------|-------|
| Create `main` branch with scaffold | ✅ Done | README, .gitignore, base package.json |
| Create `dev-anubhav` branch | ✅ Done | All work on this branch, PRs to `main` |
| Push both branches to origin | ✅ Done | |
| Create PLAN.md, PROGRESS.md, HANDOFF.md | ✅ Done | |
| Create `MINTZY_DESKTOP_APP_PLAN.pdf` | ✅ Done | Complete plan doc with diagrams, API contracts, timeline |
| Install Electron + build deps | ✅ Done | Electron v43.1.1, electron-builder v26.15.3 |
| electron-builder.yml config | ✅ Done | NSIS per-user, Win x64, unsigned |
| Hardened BrowserWindow (main.js) | ✅ Done | contextIsolation, sandbox, no nodeIntegration |
| Minimal preload.js with contextBridge | ✅ Done | Auth, navigation, window, system channels |
| Window state persistence service | ✅ Done | JSON file in userData, default 1440x900 |
| Auth service (mocked) | ✅ Done | 3 error modes: invalid/expired/broker-expired |
| Storage service (safeStorage) | ✅ Done | DPAPI encryption, base64 fallback |
| Login screen HTML/CSS/JS | ✅ Done | Dark Mintzy theme, API key input, error display |
| IPC wiring (login flow) | ✅ Done | Login form → main process → auth result |
| Error/offline screen | ✅ Done | Distinct messages for network vs broker expiry |
| Token injection mechanism | ✅ Done | localStorage via executeJavaScript + page reload |
| Plugin URL configured | ✅ Done | `https://www.mintzy.in/plugin/sessions` |
| Repo inspection (frontend) | ✅ Done | Understood auth flow, localStorage, ConnectBrokerForm |
| Repo inspection (backend) | ✅ Done | Understood API key model, middleware, error patterns |

#### Done (Phase 1.3)
| Item | Status | Notes |
|------|--------|-------|
| Append `?broker=` query param | ✅ Done | URL now includes `?broker=` from auth response |
| Set refresh cookie via Electron API | ✅ Done | `session.cookies.set()` for httpOnly refresh token on `.mintzy.in` |
| Real-world test with Plugin URL | ⏳ Blocked | Needs backend exchange endpoint |

---

## Phase 2 — Core Wrapper & Session Handling (Days 4–7) — ✅ Complete

| Item | Status | Notes |
|------|--------|-------|
| Silent revalidation on relaunch | ✅ Done | `handleAuthRevalidate()` reads stored API key, exchanges for fresh tokens |
| Handle token refresh failures | ✅ Done | Broker expired → error screen; invalid/revoked → login with message |
| Session persistence | ✅ Done | Stored credentials revalidated on app start via `revalidateSession()` |

---

## Phase 3 — Native Features & Edge Cases (Days 8–10)

| Item | Status | Notes |
|------|--------|-------|
| Tray icon + minimize to tray | ❌ Pending | |
| Tray menu (Open/Logout/Quit) | ❌ Pending | |
| Auto-launch toggle | ❌ Pending | |
| Sleep/resume reconnect | ❌ Pending | |
| Notifications hookup | ❌ Pending | Depends on backend websocket |
| Uninstall/reinstall clean-state test | ❌ Pending | |

---

## Phase 4 — Real Auth Integration & Build (Days 11–13)

| Item | Status | Notes |
|------|--------|-------|
| Swap mocked auth for real endpoint | ❌ Pending | Blocked on backend exchange endpoint |
| Full integration test | ❌ Pending | Needs frontend changes too |
| electron-builder installer build | ❌ Pending | |
| Apply Mintzy branding/icons | ❌ Pending | |
| Buffer / fix breakage | ❌ Pending | |

---

## External Dependencies

### Backend (`mintzy-backend-new`)
| Item | Status | Notes |
|------|--------|-------|
| `POST /api/auth/exchange-api-key` endpoint | ❌ Not started | Takes API key → returns JWT + broker type |
| `brokerType` field on `tradingApiKey` model | ❌ Not started | Store broker type during key generation |
| Update key generation to accept `brokerType` | ❌ Not started | |

### Frontend (`mintzy-frontend-repo`)
| Item | Status | Notes |
|------|--------|-------|
| API key management UI (Account Settings) | ❌ Not started | Generate key with broker type selector |
| `ConnectBrokerForm` — accept `initialBrokerType` prop | ❌ Not started | Hide dropdown when set |
| `plugin/sessions/page.tsx` — read `?broker=` param | ❌ Not started | Pass to ConnectBrokerForm |

---

## Testing Checklist (1.5 weeks post-Phase 4)

- [ ] Fresh install on clean Windows 10 and Windows 11 machines
- [ ] Real API key login → correct broker type auto-applied, no broker picker
- [ ] Invalid/expired API key → clear error, no crash
- [ ] Relaunch after successful login → skips login screen, loads terminal directly
- [ ] Broker-side session expiry mid-use → clear distinct message
- [ ] Close button → tray, not full quit; Quit from tray → fully exits
- [ ] Double-launch attempt → focuses existing window
- [ ] Auto-launch toggle survives Windows restart
- [ ] Laptop sleep/resume mid-session → reconnects cleanly
- [ ] Network drop while terminal open → no crash, retry screen works
- [ ] Window size/position remembered across restarts
- [ ] Uninstall → clean removal; reinstall → fresh login prompt
- [ ] Test with real consumer AV → check for false-positive quarantine
- [ ] Confirm no backend/website repo was modified (read-only respected)
- [ ] Confirm app only exposes Plugin product
