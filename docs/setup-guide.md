# PortSentinel Nexus setup

> Provider update: the user authorized SambaNova as an alternative to Bob. The active configuration is now SambaNova / Llama 3.3 70B. Earlier Bob-only descriptions below document the prior implementation. See [current SambaNova configuration](sambanova-integration.md). Live requests reached SambaNova, but inference is blocked by its payment-method requirement. No successful completion is claimed.

## Prerequisites

Python 3.12, Node.js 22.12+ and npm. This workspace was tested with Python 3.12.14 and Node 24.19. A browser with WebGL enables the port scene; the other modules have no WebGL dependency. Initial installation and external weather require internet access.

## Backend — PowerShell from repository root

```powershell
python -m venv src/backend/.venv
& src/backend/.venv/Scripts/python.exe -m pip install -r src/backend/requirements.txt
Copy-Item src/.env.example src/backend/.env
Set-Location src/backend
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The environment and dependencies are already installed in the working copy. Do not overwrite an existing configured `.env`. On macOS/Linux use `python3` and `.venv/bin/python`. SQLite initializes automatically under `src/backend/data/`; no external database is required. The exact supplied model is included under `src/backend/models/`.

## Frontend — second terminal, repository root

```powershell
npm.cmd --prefix src/frontend ci
npm.cmd --prefix src/frontend run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` to the local backend on port 8000. API documentation: http://127.0.0.1:8000/docs. Both processes must remain running. This is a local prototype; no production deployment/authentication is configured.

## Configuration

All values live in `src/backend/.env` (or `src/.env`). None uses a public `VITE_` variable.

| Variable | Purpose |
|---|---|
| `FAILURE_MODEL_PATH` | Optional absolute path; file must match the inspected artifact SHA-256. |
| `PORT_DATABASE_PATH` | Optional absolute SQLite path. |
| `FAILURE_POSITIVE_CLASS_CONFIRMED` | Default false. Set true only after the training owner confirms class 1 means failure. This does not validate feature formulas. |
| `OPERATOR_TOKEN` | Optional token required for writes; enter the same value in Settings for the current browser session. Not a Bob key. |
| `BOB_API_URL`, `BOB_API_KEY`, `BOB_API_MODEL` | Real Bob inference endpoint, credential and model identifier; currently unavailable. |
| `BOB_API_PROTOCOL` | Default unconfigured. `chat-completions` activates the conditional adapter only after its contract is verified against Bob documentation. |
| `BOB_API_AUTH_HEADER`, `BOB_API_AUTH_PREFIX` | Authentication format per the actual Bob contract. |
| `BOB_API_TEAM_HEADER`, `BOB_API_TEAM_ID` | Optional team routing per the actual Bob contract. |

Open-Meteo requires no key for this prototype. Weather coordinates are fixed to the Kandla reference location. Restart the backend after configuration changes.

## Checks

```powershell
npm.cmd --prefix src/frontend run typecheck
npm.cmd --prefix src/frontend run build
npm.cmd --prefix src/frontend run format:check
Set-Location src/backend
& .venv/Scripts/python.exe -m pytest -q --basetemp=data/pytest-temp
```

## Demonstration

1. Enter Live Port View, inspect a berth, then open Alerts.
2. Compare backend-ranked responses and open Approvals.
3. Approve, or select an evaluated alternative and modify with a comment, or reject with a reason. Confirm the decision.
4. Inspect the persisted decision, accepted plan and audit history. Reload to verify persistence.
5. Edit management records and inspect the recalculated report.
6. Settings can advance six simulated hours, degrade equipment, restore equipment or reset seeded records. Reset preserves decision/audit history.
7. Weather shows provider time, normalized units, forecasts and outage status. Ask Bob explicitly requests an explanation; missing configuration produces a labeled deterministic response.

## Troubleshooting

Backend unavailable: start port 8000 and retry. Stale revision/analysis: refresh and review current inputs. WebGL unavailable: enable graphics acceleration or use the berth list. Weather unavailable: retry later; values are never replaced with fake live readings. Model unavailable: verify the supplied checksum and pinned dependencies. Do not use an unrelated pickle file. Bob unavailable: confirm the actual inference contract and credentials, then test a genuine request; mock transport tests do not prove IBM connectivity.
