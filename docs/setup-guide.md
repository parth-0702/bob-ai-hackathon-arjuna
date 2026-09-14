# PortSentinel Nexus — Setup Guide

## Current scope

Frontend prototype with local simulated data. No backend, ML model, weather API, AIS feed, authentication or equipment control is connected.

## Prerequisites

- Node.js 22.12+ (validated using Node 24.19) and npm.
- A modern browser. WebGL is required for the interactive 3D view; other modules work independently.
- Internet access for the initial package installation. Typography requests Google Fonts, with local sans-serif fallbacks.

## Install and run

From the repository root:

```sh
npm --prefix src/frontend ci
npm --prefix src/frontend run dev
```

Open http://127.0.0.1:5173. If that port is occupied, use the URL printed by Vite.
No environment variables are required for this phase; `src/.env.example` documents this.

## Build and inspect

```sh
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run build
npm --prefix src/frontend run preview
```

The production output is `src/frontend/dist/` (generated, not committed).

## Verify the main journey

1. Open the archival-photo landing page and enter Live Port View.
2. Drag to orbit, scroll to zoom, and hover a quay or crane. Click a berth or use its accessible list button.
3. Select the 24/48-hour outlook and investigate the risk.
4. In Alerts, select a predefined response and open Approvals.
5. Approve, modify with a comment, or reject with a reason. Confirm the decision and inspect the resulting simulated plan.
6. Reload to verify browser persistence.
7. Use Assets, Vessels, Berths and Cranes to add/edit records; try search and status filters.
8. Settings provides an explicit confirmation to restore the initial demo scenario.

## State checks

- `/?state=loading`: three-second demo loading state.
- `/?state=error`: simulated service failure; Retry attempts the same failed service until the query is removed.
- `/?state=empty#Assets`: empty register.
- `/?state=empty#Alerts`: no resources / no alerts state.

These are development/demo fixtures, not backend status endpoints.

## Troubleshooting

| Symptom | Action |
|---|---|
| Blank/unavailable 3D view | Enable browser graphics acceleration; other modules remain available. |
| Changes disappear on another device | Demo data is stored only in this browser; there is no shared database. |
| Saved data cannot be read | Use Reset demo data on the error screen. |
| Could not save | Allow browser storage or free local storage space. |
| Installation cannot reach registry | Check network access to the npm registry. |
| Local page cannot open | Keep the dev server running and use its printed port. |

The IBM submission validator is unmodified. A successful frontend build does not mean the full hackathon submission is complete; team metadata, final demo recording, slides and submission documentation still require completion.
