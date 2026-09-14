# PortSentinel Nexus

> Provider update: the user authorized SambaNova as an alternative to Bob. The active configuration is now SambaNova / Llama 3.3 70B. Earlier Bob-only descriptions below document the prior implementation. See [current SambaNova configuration](docs/sambanova-integration.md). Live requests reached SambaNova, but inference is blocked by its payment-method requirement. No successful completion is claimed.

**See the bottleneck before it becomes congestion.**

PortSentinel Nexus connects infrastructure health, operational dependencies and port congestion so operators can compare responses before accepting a plan. Deendayal/Kandla Port is the reference environment. The project combines the locked L1 congestion/port-operations and U1 equipment/power-risk problem statements.

The application includes the locked Home, Live Port View, Alerts, Approvals, Congestion, Weather, Assets, Vessels, Berths and Cranes experience. The homepage uses an attributed archival port photograph; the interactive quay is illustrative. Port records are simulated and stored by the backend. Open-Meteo provides separately labeled external weather.

## Run locally

See [exact setup commands](docs/setup-guide.md). Start the FastAPI server on port 8000 and the React/Vite frontend on port 5173. Python 3.12 and Node 22.12+ are required.

## Implemented

- React/TypeScript interface with an interactive Three.js port scene and editable registers.
- The supplied calibrated XGBoost artifact runs without retraining; original embedded model bytes recover an incompatible saved memory snapshot.
- Deterministic dependency traversal, berth queues, scenario evaluation and ranking.
- Server-side weather normalization, caching and explicit outage states.
- SQLite registers, immutable analysis snapshots, transactional human decisions and audit history.
- Bob-only explanation adapter with grounded output validation. Actual Bob inference remains unverified pending the team's API contract and credentials.

## Important limitations

The saved model's class-1 meaning and feature preprocessing are not supplied. Its actual output is shown as a class-1 probability; the operational simulator uses equipment health until semantics are confirmed. Live weather is not silently transformed into unknown model features. Simulation scores are engineering heuristics, not calibrated port predictions. Accepted plans issue no equipment commands.

## Documentation

- [Problem statement](docs/problem-statement.md)
- [Solution overview](docs/solution-overview.md)
- [Architecture and API reference](docs/architecture.md)
- [Implementation report and validation](docs/implementation-report.md)
- [Setup guide](docs/setup-guide.md)

## Submission status

All application code remains under `src/`; the IBM validation workflow is preserved. Team name, track, lead/contact details, final recording and presentation remain to be supplied. The complete submission validator is therefore not yet expected to pass. No Bob-assisted development history has been fabricated.
