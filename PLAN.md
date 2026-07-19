# Mintzy Plugin Desktop App — Build Plan (v2)

## Overview

Standalone Electron desktop app for the Mintzy Plugin terminal. Has its own React UI (login, profile, plugin terminal) and talks exclusively to the `mintzy-api-gateway`. No dependency on the website backend (`mintzy-backend-new`) or website frontend (`mintzy.in`).

**Repo**: `github.com/Mintzy-V1/Plugin-App-Desktop`
**Branch strategy**: `main` (scaffold only) ← PRs from `dev-anubhav` (all work)
**Distribution**: Windows 64-bit only, NSIS per-user installer, unsigned
**Backend**: `mintzy-api-gateway` (separate repo)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron App                    │
│  ┌───────────────────────────────────────────┐  │
│  │         Main Process (Node.js)            │  │
│  │  Auth, Storage, Tray, IPC, Window State   │  │
│  └──────────────────┬────────────────────────┘  │
│                     │ IPC                        │
│  ┌──────────────────▼────────────────────────┐  │
│  │         Renderer (React SPA via Vite)      │  │
│  │                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │  Login   │  │  Plugin  │  │Profile/ │  │  │
│  │  │  Screen  │  │ Terminal │  │Dashboard│  │  │
│  │  └──────────┘  └──────────┘  └─────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│         All API calls → mintzy-api-gateway        │
└──────────────────────────────────────────────────┘
```

### Key Decisions
- **No website wrapper** — app loads its own React UI, not `mintzy.in`
- **Standalone backend** — all API calls go to `mintzy-api-gateway`
- **JWT auth** — 24hr token from `POST /api/v1/broker/onboard`, stored in `localStorage` as `mintzy_token`
- **API key login** — user enters API key → gateway validates → returns JWT + broker + user
- **Broker operations** — `/api/v1/angle_one/*` and `/api/v1/tradex/*` via gateway
- **No pricing/billing** — app links to website for plans, payments, admin features

---

## Phased Build Plan

### Phase 1 — Build Foundation (Current)
Branch: `dev-anubhav`

| Step | Description | Est. Lines |
|------|-------------|-----------|
| 1.1 | Update PLAN.md, PROGRESS.md with new architecture | ~50 |
| 1.2 | Install Vite + React + TypeScript + deps | ~10 |
| 1.3 | Create Vite config, tsconfig, index.html for renderer | ~50 |
| 1.4 | Create React entry point, App shell with router/views | ~100 |
| 1.5 | Create API service layer (axios → gateway) | ~80 |
| 1.6 | Create Auth context + login page | ~120 |
| 1.7 | Update main process to serve Vite renderer | ~80 |

### Phase 2 — Plugin Terminal
| Step | Description | Est. Lines |
|------|-------------|-----------|
| 2.1 | ConnectBroker form (broker select, API key, client code, password) | ~120 |
| 2.2 | TwoFactorAuth (TOTP input) | ~60 |
| 2.3 | SessionConfigForm + TradingConfigurationFields + TickerSelector | ~200 |
| 2.4 | LiveSessionDashboard + LivePnlPanel with Recharts | ~250 |
| 2.5 | PluginSidebar (live/past sessions list, saved strategies) | ~100 |
| 2.6 | Session state machine wiring (empty → broker → 2fa → config → dashboard) | ~80 |

### Phase 3 — User Dashboard
| Step | Description | Est. Lines |
|------|-------------|-----------|
| 3.1 | DashboardShell with sidebar navigation (Profile, Plugin, Settings) | ~100 |
| 3.2 | ProfileTab (user info, name, email, account ID) | ~60 |
| 3.3 | PluginTab (PnL summary, session list, tradebook download) | ~150 |
| 3.4 | SettingsTab (auto-launch toggle, logout, about) | ~50 |

### Phase 4 — Polish & Integration
| Step | Description | Est. Lines |
|------|-------------|-----------|
| 4.1 | Wire IPC for safeStorage (main process stores API key) | ~50 |
| 4.2 | Tray icon + minimize to tray integration | ~30 |
| 4.3 | Silent revalidation on relaunch | ~40 |
| 4.4 | Error boundaries, offline screen, error states | ~60 |
| 4.5 | electron-builder NSIS build config | ~30 |
| 4.6 | Dev mock mode fallback | ~40 |

---

## Out of Scope (v1)
- Auto-update mechanism
- Code signing
- macOS/Linux builds
- Pricing, billing, payment screens
- Admin features
- Any feature that exists on the website but is not listed above
