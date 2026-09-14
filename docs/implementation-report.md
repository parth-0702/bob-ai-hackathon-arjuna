# Implementation and validation report

> Provider update: the user authorized SambaNova as an alternative to Bob. The active configuration is now SambaNova / Llama 3.3 70B. Earlier Bob-only descriptions below document the prior implementation. See [current SambaNova configuration](sambanova-integration.md). Live requests reached SambaNova, but inference is blocked by its payment-method requirement. No successful completion is claimed.

## Delivered architecture

The frontend now calls FastAPI through a Vite `/api` proxy. Python owns operational data, inference, weather, dependencies, queues, scenarios, recommendation ranking, explanations and persistence. SQLite avoids a separate database service for the local demonstration. See [architecture and every endpoint](architecture.md) and [exact startup commands/environment variables](setup-guide.md).

The locked module structure and human-controlled flow are retained. Register edits persist on the backend and regenerate analysis. The live scene is illustrative, with backend-supplied vessels, cranes, berth data and forecast details. The homepage uses an archival Deendayal Port Authority photograph, not a camera feed.

## Supplied model inspection

Artifact: `src/backend/models/model1_failure_risk_weather.pkl` (1,884,073 bytes).

SHA-256: `8926d985a056f01f57d3f981e3b67bfed7d16d172c0859f43d6d123b90acb28c`.

The joblib dictionary contains `model`, `feature_cols`, `low_thresh`, `high_thresh`. The model is sklearn `CalibratedClassifierCV` over XGBoost `XGBClassifier`, with three calibrated estimators, classes `[0,1]`, sigmoid calibration and probability support. Saved sklearn version is 1.6.1; XGBoost snapshots identify 3.4.1.

The exact ordered features are:

```text
Air_temperature, Process_temperature, Rotational_speed, Torque,
Tool_wear, Temp_diff, Torque_x_Speed, Power_est,
Type_H, Type_L, Type_M, Ambient_temp_C, Wind_speed_kmh,
Rainfall_mm, Storm_flag, Weather_stress_index
```

Saved thresholds are 0.010205103911579477 and 0.020410207823158954. Standard deserialization failed with a corrupt XGBoost memory snapshot even with matching versions. The checksum-pinned loader extracts each original embedded UBJSON `Model` object and calls `Booster.load_model`; sklearn's original calibration remains intact. No artifact overwrite, retraining or substitute model occurred. This recovery is specific to this inspected file; no equivalence claim to unavailable training-environment golden outputs is made.

Actual inference on the complete synthetic vectors in `app/failure_model.py` returned class-1 probabilities 0.012711115389175342 and 0.7242755193378091. Missing features, non-finite inputs and invalid type indicators are rejected. The artifact does not supply training units/formulas or confirm class-1 semantics. Therefore failure probability remains unavailable until confirmed, and live weather is not inserted into unknown engineered transformations.

## Congestion and scenarios

No labeled port training dataset was supplied. A deterministic berth queue simulator is used instead of inventing a trained congestion model. It evaluates the same records, rates, arrivals, health, constraints and weather factors for every scenario. Dependencies expose power/crane/berth/vessel impact. Five response templates are ranked by transparent delay/congestion/effort scores. See architecture for formula, feasibility checks and assumptions.

## Weather

A real request to Open-Meteo succeeded from this environment, returning normalized Kandla current conditions and hourly forecasts. The service converts units, labels provider time, caches results and exposes outages without substituted readings. Weather is external modeled data; port telemetry and future infrastructure conditions remain simulated.

## Bob API

Implemented Bob-only configuration, server-side secret handling, conditional HTTP transport and grounded-output checks. Mock transport testing verifies context transmission and rejection of invented fact IDs. A genuine Bob request has **not** been verified: endpoint, contract, model ID and credentials are still required. Deterministic fallback text is labeled in the UI and is not presented as Bob-generated prose.

## Decisions and persistence

Approved and modified decisions save an accepted demo plan; rejected decisions save an audit record with no new accepted plan. Modification selects an evaluated response and records operator conditions. No free-text action is silently executed. Transactions, revision checks and idempotency protect against stale or duplicate decisions. Historical plans retain their input report. This is a single-operator local prototype, not production identity management.

## Validation performed

- Backend started successfully on loopback port 8000; `/api/snapshot` returned registers, actual model outputs, weather, dependencies, alerts and ranked responses.
- Eleven pytest cases passed on the final run: real artifact inference/invalid features; register validation/revision persistence; approve/modify/reject with comments and idempotency; stale approvals and recalculation; weather outage/cache; mock Bob grounding; normalized/stale weather; database persistence across app restarts; supply outage and changed-weather approval protection.
- TypeScript check and production frontend build passed after backend integration. Three.js is lazy-loaded; its approximately 540 kB uncompressed chunk produces a non-failing size advisory.
- Browser confirmed backend-generated Alerts and the connected Approvals screen. Earlier frontend checks covered all modules, register add/edit/search, mobile layout, and confirmation flows. Connected browser checks also confirmed explicit Bob fallback, successful approval submission, a rendered 3D scene, 48-hour controls, backend berth/dependency details and externally sourced Weather. Pointer hover/orbit and final mobile retesting were not completed in this pass.
- Required template paths remain present; `.github/workflows/validate.yml` is unmodified. Full submission completeness cannot pass until team details, final recording and presentation are supplied.

## Important files

- `src/frontend/src/App.tsx`: retained navigation and register workflows.
- `src/frontend/src/services/portService.ts`: HTTP client; no embedded operational fixture service.
- `src/frontend/src/components/ConnectedOperations.tsx`: backend alerts, decisions, explanations and simulation controls.
- `src/frontend/src/components/PortScene.tsx`: illustrative interactive port.
- `src/backend/app/main.py`, `pipeline.py`, `store.py`: API, orchestration, persistence.
- `src/backend/app/failure_model.py`, `weather.py`, `dependencies.py`, `congestion.py`, `scenarios.py`, `llm.py`: separated engines/integrations.
- `src/backend/tests/test_pipeline.py`: executable integration checks.

## Remaining limits

Training preprocessing and class meaning need owner confirmation. Bob's genuine inference contract and credentials remain missing. The simulator has no real AIS, telemetry, terminal integration, surveyed quay model or calibrated port accuracy. Repair timing, cargo/lifting compatibility and pilot/tug availability require operator checks. Weather uses actual time while port simulation may advance separately. The archive photograph has attribution but no redistribution license was verified; confirm rights or replace it before public distribution. Team metadata and final submission media are unfinished.

## Sources used

- [Open-Meteo API documentation](https://open-meteo.com/en/docs)
- [XGBoost model IO and snapshot portability](https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html)
- [Bob API key documentation](https://bob.ibm.com/docs/ide/account/api-keys) — key types only; not evidence of a verified inference contract.
- [Official submission template](https://github.com/drijesh-ppatel/bob-ai-hackathon-submission-template)
- [Deendayal Port Authority archive photograph](https://x.com/Deendayal_Port/status/1652897833476046848)
