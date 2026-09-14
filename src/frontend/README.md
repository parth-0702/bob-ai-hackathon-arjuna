# PortSentinel Nexus frontend

React + TypeScript + Vite application, with a lazy-loaded Three.js operational scene.
All application source and dependencies remain inside this folder, as required by the IBM submission template.

## Run

From the repository root:

```sh
npm --prefix src/frontend ci
npm --prefix src/frontend run dev
```

Open http://127.0.0.1:5173. Build with `npm --prefix src/frontend run build`.

## Layout

- `src/App.tsx`: navigation shell, alerts/review workflow and local register management.
- `src/components/PortScene.tsx`: interactive illustrative port, pointer picking, orbit camera and animation lifecycle.
- `src/components/OperationalUI.tsx`: status badges and scenario forecast chart.
- `src/components/WeatherPanel.tsx`: operational weather presentation.
- `src/components/CongestionPanel.tsx`: congestion view.
- `src/services/portService.ts`: typed demo repository, initial fixtures, response catalogue and local persistence.
- `src/styles.css`: responsive visual system, mobile navigation, dialogs and reduced-motion rules.
- `public/images/kandla-jetty.jpg`: archival port-authority photograph; see `docs/frontend-implementation.md` for attribution.

No frontend environment variables or secrets are required. Backend services are not connected.
See `../../docs/frontend-implementation.md` for integration boundaries and the browser QA record.
