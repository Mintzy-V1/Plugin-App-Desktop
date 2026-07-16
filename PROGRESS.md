# Mintzy Plugin Desktop App — Progress Log

## Tracking
- **Build start**: July 16, 2026
- **Target**: 2.5 weeks (12–13 working days)
- **Phase scope**: MVP — Plugin product only, Windows 64-bit, unsigned NSIS installer

---

## Phase 1 — Setup, Repo, Auth Foundation (Days 1–3)

### Day 1 — July 16

| Item | Status | Notes |
|------|--------|-------|
| Create `main` branch with scaffold | ✅ Done | README, .gitignore, base package.json |
| Create `dev-anubhav` branch | ✅ Done | All work on this branch, PRs to `main` |
| Push both branches to origin | ✅ Done | |
| Create PLAN.md | ✅ Done | |
| Create PROGRESS.md | ✅ Done | |
| Create HANDOFF.md | ✅ Done | |
| Install Electron + build deps | ✅ Done | Electron v43.1.1, electron-builder v26.15.3 |
| electron-builder.yml config | ✅ Done | NSIS per-user, Win x64, unsigned |
| Hardened BrowserWindow (main.js) | ✅ Done | contextIsolation, sandbox, no nodeIntegration |
| Minimal preload.js with contextBridge | ✅ Done | Auth, navigation, window, system channels |
| Window state persistence service | ✅ Done | JSON file in userData, default 1440x900 |
| Auth service (mocked) | ✅ Done | 3 error modes: invalid/expired/broker-expired |
| Storage service (safeStorage) | ✅ Done | DPAPI encryption, base64 fallback |
| Login screen HTML/CSS/JS | ✅ Done | Dark Mintzy theme, API key input, error display |
| IPC wiring (login flow) | ✅ Done | Login form → main process → auth result |
| Plugin terminal loading spike | ⏳ Day 2 | Mechanism depends on mintzy-frontend-repo inspection |
| Error/offline screen | ✅ Done | Distinct messages for network vs broker expiry |

### Backend Coordination
| Item | Status | Notes |
|------|--------|-------|
| Request read access to `mintzy-backend-new` | ❌ Not started | Needed to understand API contracts |
| Request read access to `mintzy-frontend-repo` | ❌ Not started | Needed to see how website passes session into terminal |
| Confirm auth endpoint schema with backend | ❌ Not started | Critical — even if endpoint isn't live yet |
| Confirm broker type field/format | ❌ Not started | |
| Confirm session injection mechanism | ❌ Not started | |
| Confirm verify/me endpoint exists | ❌ Not started | |
| Confirm distinct error codes | ❌ Not started | |
| Confirm websocket/event channel | ❌ Not started | For notifications feature |
| Confirm "Generate API Key" feature on website | ❌ Not started | App needs this to exist |

---

## Phase 2 — Core Wrapper & Session Handling (Days 4–7)

| Item | Status | Notes |
|------|--------|-------|
| Silent revalidation on relaunch | ❌ Pending | |
| Two distinct error paths | ❌ Pending | |
| Window state persistence | ❌ Pending | |
| Offline/error retry screen | ❌ Pending | |

---

## Phase 3 — Native Features & Edge Cases (Days 8–10)

| Item | Status | Notes |
|------|--------|-------|
| Tray icon + minimize to tray | ❌ Pending | |
| Tray menu (Open/Logout/Quit) | ❌ Pending | |
| Auto-launch toggle | ❌ Pending | |
| Sleep/resume reconnect | ❌ Pending | |
| Notifications hookup | ❌ Pending | |
| Uninstall/reinstall clean-state test | ❌ Pending | |

---

## Phase 4 — Real Auth Integration & Build (Days 11–13)

| Item | Status | Notes |
|------|--------|-------|
| Swap mocked auth for real endpoint | ❌ Pending | Blocked on backend endpoint |
| Full integration test | ❌ Pending | |
| electron-builder installer build | ❌ Pending | |
| Apply Mintzy branding/icons | ❌ Pending | |
| Buffer / fix breakage | ❌ Pending | |

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
