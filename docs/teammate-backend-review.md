# Teammate backend comparison

Reviewed the supplied `backend.zip` directly, without replacing the existing backend, installing its packages or executing archive code. Conclusions apply to this ZIP, not any files your teammate may have elsewhere.

## Assessment

The current FastAPI backend is the more complete base for the locked PortSentinel Nexus workflow. Neither implementation is production-ready. Retain the working model loader, SQLite persistence, dependency/queue/scenario engines and human decisions. Adapt selected weather ideas from the TypeScript implementation.

| Area | Supplied ZIP | Current project |
|---|---|---|
| Startup completeness | `portStateService.ts` imports `../data/simulatedData.js`, absent from the archive. | Starts and serves persisted operational data. |
| Failure model | Calls `http://127.0.0.1:8000/predict`; its Python service and model are absent. | Loads the original supplied artifact and tests actual inference. |
| Model preprocessing | Synthesizes readings from asset IDs, assumes engineering formulas and sends a custom 0–100 weather stress score. No training contract accompanies these choices. | Explicit engineered inputs; unknown class semantics and preprocessing remain disclosed. |
| Weather | Detailed rule explanations, compass labels and resolved provider coordinates. No cache. Request coordinates differ from the service comment/port-state coordinates. | Cached, normalized weather with explicit stale/unavailable states; selected teammate ideas now adapted. |
| Operations | Read-only fixture snapshots. | Validated editing, revision checks and database persistence. |
| Scenarios and human approval | No scenario/ranking, decision persistence or audit implementation found. | Deterministic scenarios, ranking, transactional approval/modify/reject and history. |
| Bob | No Bob client or inference contract found. | Bob-only adapter; genuine integration still awaiting endpoint/model/contract. |
| Tests | No tests included in ZIP. | 12 backend tests pass after this review. |

## Changes adopted

- Sixteen-point compass labels for wind direction, displayed on the Weather page.
- Resolved provider latitude/longitude, elevation and timezone alongside requested reference coordinates in the weather response.
- More complete weather-code descriptions, checked against [Open-Meteo documentation](https://open-meteo.com/en/docs). Unknown codes remain explicitly unknown rather than inheriting a nearby code's meaning.
- Low-visibility operational advice, labeled as a prototype advisory threshold. This is not a certified port operating limit or a new ML input.
- Current thunderstorms participate in exposure checks even if the future hourly slots do not show them.
- Additional finite-number/range validation and regression coverage found useful during the comparison.

These are adaptations to the existing Python service, not a second Express service. No module or major product-flow change was made. The shared `.env`, credentials, model artifact and operational database were not replaced.

## Not adopted

The teammate's heuristic weather-stress score is not evidence of the trained model's `Weather_stress_index` definition. Its units, scaling and other feature transformations need the training owner's confirmation before use. The direct `/predict` call also differs from our `/api/model/predict` request schema. Copying that service verbatim would break integration. The coordinate change was not adopted without location evidence.

## Verification and limitations

Regression suite: 12 tests passed, including actual inference, database restart persistence, decision outcomes/idempotency/staleness, weather failure/normalization and the newly adapted weather behavior. The archive was statically reviewed, not build-tested; its missing imported data module and external Python service prevent it being a self-contained runnable submission as supplied. The current project still lacks verified Bob API connectivity and the training preprocessing/class contract, and uses an approximate operational simulator.
