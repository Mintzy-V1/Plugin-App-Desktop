# Mintzy Plugin Desktop App — Progress Log

## Tracking
- **Build start**: July 16, 2026
- **Architecture v2 start**: July 19, 2026
- **Phase scope**: Standalone Electron + React app talking to `mintzy-api-gateway`

---

## Phase 1 — Build Foundation (In Progress)

| Item | Status | Notes |
|------|--------|-------|
| PLAN.md updated with v2 architecture | ✅ Done | Switched from website wrapper to standalone React SPA |
| PROGRESS.md updated | ✅ Done | Tracking the new phased plan |
| Vite + React + TypeScript + deps installed | ✅ Done | react, react-dom, axios, lucide-react, recharts, framer-motion |
| Vite config + tsconfig + index.html | 🔜 Next | |
| React entry + App shell with views | 🔜 Next | |
| API service layer (axios → gateway) | 🔜 Next | |
| Auth context + login page | 🔜 Next | |
| Update main process to serve Vite renderer | 🔜 Next | |

---

## Phase 2 — Plugin Terminal (Not Started)

| Item | Status | Notes |
|------|--------|-------|
| ConnectBroker form | ❌ Not started | Broker select, API key, client code, password |
| TwoFactorAuth (TOTP) | ❌ Not started | 6-digit TOTP input |
| SessionConfigForm + fields | ❌ Not started | Trading config, ticker selector |
| LiveSessionDashboard + PnL | ❌ Not started | Realtime dashboard with charts |
| PluginSidebar | ❌ Not started | Session list, saved strategies |
| Session state machine | ❌ Not started | empty → broker → 2fa → config → dashboard |

---

## Phase 3 — User Dashboard (Not Started)

| Item | Status | Notes |
|------|--------|-------|
| DashboardShell + sidebar | ❌ Not started | Profile, Plugin, Settings tabs |
| ProfileTab | ❌ Not started | User info display |
| PluginTab | ❌ Not started | PnL summary, sessions, tradebook |
| SettingsTab | ❌ Not started | Auto-launch, logout, about |

---

## Phase 4 — Polish & Integration (Not Started)

| Item | Status | Notes |
|------|--------|-------|
| safeStorage IPC wiring | ❌ Not started | Main process encrypts API key |
| Tray + minimize integration | ❌ Not started | System tray, close to tray |
| Silent revalidation | ❌ Not started | Auto-login on relaunch |
| Error boundaries | ❌ Not started | Offline, error states |
| NSIS build config | ❌ Not started | electron-builder setup |

---

## Completed (Legacy - v1 Architecture)

The following were built under the original website-wrapper architecture and will be replaced/refactored in v2:

| Item | v2 Disposition |
|------|---------------|
| Native login HTML/CSS/JS | 🔄 Replace with React login |
| api.js (net.request) | 🔄 Replace with axios |
| auth.js mock | 🔄 Replace with React auth context |
| main.js plugin URL loading | 🔄 Replace with React routing |
| Error screen HTML | 🔄 Replace with React error boundaries |
| Preload IPC channels | ♻️ Keep & refactor |
| Window state persistence | ♻️ Keep |
| safeStorage (storage.js) | ♻️ Keep |
| Tray + auto-launch | ♻️ Keep |
| electron-builder.yml | ♻️ Keep |
| Single-instance lock | ♻️ Keep |
| Sleep/resume handling | ♻️ Keep |
| Notifications | ♻️ Keep |
