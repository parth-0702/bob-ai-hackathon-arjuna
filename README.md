# PortSentinel Nexus

Port infrastructure risk, congestion analysis and human-reviewed operational plans.

## Team

| Field | Value |
|---|---|
| Team Name | arjuna |
| Track | AI |
| Selected Problem Statements | L1 — Container Congestion Predictor and Port Operations Optimiser; U1 — Power Outage Prediction and Grid Equipment Failure Advisor |
| Team Lead | Oza Parth Bharatbhai — 24cs055@charusat.edu.in |
| Members | Manav Lakhani, Dharm lakhani, Rudra Vaghela |

Team details are recorded in [submission.yaml](submission.yaml). The L1 + U1 project is categorized under the AI track.

## Problem Statement

Port operators coordinate vessel arrivals, berth assignments, crane capacity and power infrastructure under changing weather. Equipment degradation can reduce handling capacity and propagate vessel delays. This project combines the L1 port-congestion and U1 equipment/power-risk problem areas using Deendayal Kandla Port as its reference setting.

## Solution

PortSentinel Nexus connects equipment condition and weather to operational dependencies, berth queues and evaluated response scenarios. Operators compare responses and approve, modify or reject a plan; SQLite preserves the analysis and decision history. AI organizes authoritative backend facts into a point-wise explanation while deterministic engines own calculations and ranking.

## Key Features

- Interactive illustrative port view and editable Assets, Vessels, Berths and Cranes registers, including confirmed crane and berth deletion.
- Supplied calibrated XGBoost inference with explicit input provenance and external Open-Meteo weather.
- Asset-to-crane-to-berth-to-vessel dependencies, 48-hour queue simulation and five ranked responses.
- Human approvals, evaluated alternatives, operator conditions, accepted plans and audit history.
- Point-wise explanations from a selected Groq, SambaNova or Bob adapter, with a labeled deterministic fallback.

## Tech Stack

| Category | Technologies |
|---|---|
| Languages | Python, TypeScript |
| Frameworks | FastAPI, React, Vite |
| IBM Technologies | Optional Bob API adapter; genuine IBM inference and Bob development evidence are not established |
| Databases | SQLite |
| Other | Three.js, XGBoost, scikit-learn, pandas, HTTPX, Open-Meteo, Groq/SambaNova adapters, pytest, GitHub Actions |

## Repository Structure

```text
├── .github/                  # Official validation and issue configuration
├── src/                      # All application source
│   ├── frontend/             # React and Three.js
│   ├── backend/              # Active FastAPI app, engines, model, store and tests
│   ├── model-service/        # Retained earlier standalone prototype
│   └── .env.example          # Backend configuration without credentials
├── docs/
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   ├── setup-guide.md
│   ├── submission-checklist.md
│   └── reports/              # Supporting system report
├── demo/
│   ├── screenshots/          # Final screenshots to be added
│   ├── demo-video-link.txt   # Submission recording URL
│   └── live-demo-url.txt     # Local execution declared
├── presentation/             # Final slides.pdf or slides.pptx to be added
├── .gitignore
├── CONTRIBUTING.md
├── README.md
└── submission.yaml
```

Additional notes under docs describe implementation history. Start with the four main documents for current behavior.

## How to Run

PowerShell, from a fresh checkout:

```powershell
git clone https://github.com/parth-0702/bob-ai-hackathon-arjuna.git
cd bob-ai-hackathon-arjuna
python -m venv src/backend/.venv
& src/backend/.venv/Scripts/python.exe -m pip install -r src/backend/requirements.txt
npm.cmd --prefix src/frontend ci
if (-not (Test-Path src/backend/.env)) { Copy-Item src/.env.example src/backend/.env }
& src/backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir src/backend --host 127.0.0.1 --port 8000
```

In a second terminal, from the repository root:

```powershell
npm.cmd --prefix src/frontend run dev
```

Open [the application](http://127.0.0.1:5173) or [API documentation](http://127.0.0.1:8000/docs). Python 3.12 and Node.js 22.12+ are required. SQLite seeds automatically. AI credentials are optional for local demonstration. See [full setup and tests](docs/setup-guide.md).

## Demo

| Artifact | Location and status |
|---|---|
| Demo Video | [Watch the submission video](https://drive.google.com/file/d/1UAjfhpaErKTeIjRQJw7FA3debK6w56SL/view?usp=sharing) |
| Live Demo | [Local execution](demo/live-demo-url.txt) — not deployed |
| Screenshots | [Screenshot folder](demo/screenshots/) — add at least three running-app screenshots |
| Presentation | [Presentation folder](presentation/) — add slides.pdf or slides.pptx |
| System report | [Supporting PDF](docs/reports/PortSentinel_Nexus_System_Architecture_and_Data_Flow.pdf) — earlier review; current details are in docs/architecture.md |

## Known Limitations

- Port records and the 3D scene are simulated; no AIS, telemetry or terminal system is connected.
- Class-1 model meaning and original preprocessing remain unconfirmed. Weather and machine-feature bridging uses derived demo assumptions.
- Scenario scores are engineering heuristics. Repair timing, equipment compatibility and pilot/tug availability require operator checks.
- AI availability depends on the selected provider. Configuration alone does not prove successful inference.
- Local operator-token protection is not production identity management. Accepted plans issue no equipment commands.
- Confirm redistribution rights for the archival Home photograph before public distribution.
- Screenshots and presentation remain pending; verify video access and see the [submission checklist](docs/submission-checklist.md).

## What We're Most Proud Of

The project follows one causal chain from infrastructure condition to vessel impact and a human decision. Operators compare responses against the same analysis, and the decision record preserves what was reviewed.

Layout follows the [official IBM Bobathon template](https://github.com/drijesh-ppatel/bob-ai-hackathon-submission-template). Its validation workflow is preserved.
