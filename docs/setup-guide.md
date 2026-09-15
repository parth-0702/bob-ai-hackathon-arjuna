# Setup Guide

## Prerequisites

- Python 3.12; the local environment was tested with Python 3.12.14.
- Node.js 22.12+ and npm.
- Git and PowerShell for the commands below.
- Internet for dependency installation and external weather or AI.
- Browser with WebGL for the illustrative port scene.

The app runs locally. AI credentials are optional; calculations, approvals and a labeled deterministic explanation work without them.

## Environment Variables

From the repository root, copy the template only if no local configuration exists:

```powershell
if (-not (Test-Path src/backend/.env)) { Copy-Item src/.env.example src/backend/.env }
```

| Variable | Description | Required |
|---|---|---|
| PORT_DATABASE_PATH | Absolute SQLite path; default is src/backend/data/portsentinel.sqlite3 | No |
| FAILURE_MODEL_PATH | Absolute model path; default is bundled model | No |
| FAILURE_POSITIVE_CLASS_CONFIRMED | false until training owner confirms class 1 means failure; does not validate preprocessing | No |
| OPERATOR_TOKEN | Shared local mutation token, entered in Settings | No |
| LLM_PROVIDER | groq, sambanova or bob; template defaults to sambanova | No |
| GROQ_API_KEY, GROQ_MODEL | Groq-only credentials and model; code default model qwen/qwen3.8-27b | For Groq explanations |
| SAMBANOVA_API_KEY, SAMBANOVA_MODEL | SambaNova-only credentials and model; default Meta-Llama-3.3-70B-Instruct | For SambaNova explanations |
| BOB_API_URL, BOB_API_KEY, BOB_API_MODEL | Actual verified IBM inference contract | For Bob explanations |
| BOB_API_PROTOCOL | chat-completions only after contract verification | For Bob explanations |
| BOB_API_AUTH_HEADER, BOB_API_AUTH_PREFIX | Bob authentication format | If contract differs |
| BOB_API_TEAM_HEADER, BOB_API_TEAM_ID | Optional Bob team routing | No |

Keys remain server-side. Restart the backend after changes. Selecting a provider does not verify account access or inference availability. Open-Meteo requires no key for this prototype.

## Installation

```powershell
git clone https://github.com/parth-0702/bob-ai-hackathon-arjuna.git
cd bob-ai-hackathon-arjuna
python -m venv src/backend/.venv
& src/backend/.venv/Scripts/python.exe -m pip install -r src/backend/requirements.txt
npm.cmd --prefix src/frontend ci
if (-not (Test-Path src/backend/.env)) { Copy-Item src/.env.example src/backend/.env }
```

SQLite creates and seeds itself on backend startup. The supplied model is in src/backend/models; no external database or separate model service is needed.

## Running the Application

Backend, from repository root:

```powershell
& src/backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir src/backend --host 127.0.0.1 --port 8000
```

Frontend, from repository root in a second terminal:

```powershell
npm.cmd --prefix src/frontend run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). API schemas are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Keep both processes running.

For macOS/Linux, use python3 to create the environment, src/backend/.venv/bin/python as the Python executable, and npm instead of npm.cmd. Create .env only if absent.

## Running Tests

From repository root:

```powershell
npm.cmd --prefix src/frontend run typecheck
npm.cmd --prefix src/frontend run build
npm.cmd --prefix src/frontend run format:check
Push-Location src/backend
& .venv/Scripts/python.exe -m pytest tests/test_pipeline.py -q -p no:cacheprovider
Pop-Location
```

Targeting tests/test_pipeline.py avoids collecting generated database/test directories. The most recent functional validation passed 19 backend tests and the frontend build; the subsequent explanation presentation change passed TypeScript validation.

Submission validation runs separately via the preserved .github/workflows/validate.yml. See [submission-checklist.md](submission-checklist.md) for remaining required content.

## Quick Demo (Optional)

1. Inspect B03 in Live Port View.
2. Inspect equipment records and external Weather.
3. Use Settings to degrade east-quay assets. This also advances the simulation six hours.
4. Compare Alerts, Congestion and ranked responses.
5. Review a response in Approvals and request Explain with AI if configured.
6. Approve, modify with an evaluated alternative, or reject. Inspect history and accepted plan.
7. In crane/berth edit cards, Delete requires confirmation. Berths with dependencies must be cleared first.
8. Reset restores seeded records while preserving report and decision history.

## Troubleshooting

| Issue | Solution |
|---|---|
| Backend unavailable | Start FastAPI on port 8000; retry the frontend |
| Stale revision or recommendation | Refresh and review the new analysis |
| Berth deletion blocked | Reassign listed vessels, cranes or assets |
| Weather unavailable | Retry later; the service exposes stale/unavailable status |
| AI fallback | Check the selected provider, key, model and account access; never enter an AI key into the operator-token field |
| Model unavailable | Verify included artifact and pinned dependencies; do not replace the pickle |
| Missing 3D view | Enable WebGL/hardware acceleration; use register and berth lists |
| Test directory permissions | Use a writable temporary location; tests do not need the live database |
