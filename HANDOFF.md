# Mintzy Plugin Desktop App — Handoff Notes (v2)

## Purpose
This file captures context for anyone picking up this build mid-stream — architecture, decisions, phased plan, and pending work.

---

## Architecture v2 (Standalone Electron + React SPA)

The app was **restarted** on July 19, 2026 to switch from a website-wrapper model (loading `mintzy.in` in a BrowserWindow) to a **standalone Electron app with its own React UI**. It talks exclusively to `mintzy-api-gateway`.

### Why the Change
- Separate backend (`mintzy-api-gateway`) uses its own JWT secret — incompatible with the website's auth
- Website backend going down would crash the desktop app
- Need full control over the UI (plugin terminal, dashboard, profile)
- No dependency on website frontend deployment pipeline

### Architecture

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
│  │  Login | Plugin Terminal | Profile/Dash   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│         All API calls → mintzy-api-gateway        │
└──────────────────────────────────────────────────┘
```

### Tech Stack
- **Desktop shell**: Electron 43
- **Renderer**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts (PnL)
- **API**: Axios → mintzy-api-gateway
- **Icons**: Lucide React
- **Build**: electron-builder (NSIS, Windows x64)

### Key Endpoints (mintzy-api-gateway)
| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/broker/onboard` | Exchange API key for JWT |
| `POST /api/v1/users/refresh` | Refresh JWT |
| `GET /api/v1/users/detail` | Get user info |
| `POST /api/v1/users/plan` | Get user plan/credits |
| `POST /api/v1/angle_one/credentials` | Submit Angle One creds |
| `POST /api/v1/angle_one/totp` | Submit Angle One TOTP |
| `POST /api/v1/angle_one/start` | Start Angle One trading |
| `POST /api/v1/tradex/credentials` | Submit TradeX creds |
| *(more)* | All plugin CRUD, dashboard, PnL endpoints |

---

## Phased Build Plan

See `PLAN.md` for full details. TL;DR:
1. **Phase 1** — Build foundation (Vite + React setup, app shell, auth, API layer)
2. **Phase 2** — Plugin terminal (broker connect, 2FA, config, live dashboard)
3. **Phase 3** — User dashboard (profile, plugin summary, settings)
4. **Phase 4** — Polish (safeStorage, tray, errors, build config)

---

## Commit Strategy
- Keep commits small (100–150 lines of code)
- Each commit is one logical step from the phased plan
- Branch: `dev-anubhav` → PRs to `main`

---

## External Dependencies
- **mintzy-api-gateway** — backend all desktop API calls go to
- **mintzy-frontend-repo** — source of truth for React components (we port selectively)

---

## State Machine (Plugin Terminal)
```
empty → broker → 2fa → config → dashboard
  ↑        ↓        ↓                   
  └────────┴────────┴───────────────────┘
```
