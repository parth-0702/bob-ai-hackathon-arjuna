# Application source

- `frontend/`: React, TypeScript, Vite, Three.js and lucide icons.
- `backend/`: FastAPI, SQLite, deterministic operational engines and the supplied calibrated XGBoost model.
- `.env.example`: backend-only configuration template.

The active backend entry point is `backend/app/main.py`. The TypeScript implementation in `backend/src/` and standalone `model-service/` are retained earlier prototypes, not additional services required for startup.

See [setup](../docs/setup-guide.md), [architecture](../docs/architecture.md) and [implementation report](../docs/implementation-report.md). Generated dependencies, databases and build output are ignored. Keep all application code under this directory to preserve the IBM submission structure.
