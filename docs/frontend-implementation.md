# Frontend implementation history

The original frontend-only notes below are historical. Operational fixtures and browser persistence have since been replaced by the Python API and SQLite. See [current implementation report](implementation-report.md) and [setup guide](setup-guide.md). Legacy `?state=` test switches no longer apply.

# Frontend Implementation and Integration Notes

## Product baseline

The locked UI and project/context documents govern the product. Deendayal/Kandla remains the reference environment. All nine modules are preserved. Prediction, operational impact, response selection and human approval remain distinct. No operational command is issued by the frontend.

## Design and implementation

The clean copied template contained no existing application. A client-rendered React/TypeScript app is appropriate for this operator workspace; server rendering adds no benefit in the current frontend-only phase. Vite provides the local build workflow. Local component state and URL hash navigation are sufficient for the nine modules and preserve refresh/back navigation without adding a routing/state framework.

The home page uses an actual archival photo of Kandla’s OJ-07 jetty, with a restrained camera-pan effect. It is explicitly not live footage. The operational scene is a separate, illustrative 3D cargo quay with vessels, cranes, container yards, tanks, warehouses, light/shadows and vessel movement. Orbit controls, pointer picking and keyboard-accessible berth buttons support investigation. The 3D code loads only when the operator enters Live Port View.

The visual system uses subdued industrial greens, warm neutral surfaces and amber risk indicators. Each module has its own page. Responsive layouts include a mobile navigation drawer, scrollable data tables and bounded forms. Reduced-motion preferences disable animation. Forms and detail drawers support Escape and focus cycling.

## Files changed

- Created `src/frontend/` application and package lock.
- Updated `src/README.md`, `src/.env.example`, and `docs/setup-guide.md`.
- Added this implementation/QA record.
- Preserved `submission.yaml`, root `README.md`, `CONTRIBUTING.md`, `.gitignore`, and `.github/workflows/validate.yml`.
- Preserved required documentation, demo and presentation paths. Unfinished submission placeholders were not filled with invented team or demo information.

## Backend boundary

`PortService.load(): Promise<Snapshot>` and `PortService.save(snapshot): Promise<void>` currently use local browser storage. Components consume typed register records and decisions. Replace the demo adapter as backend work begins; do not use whole-snapshot persistence as a production concurrency model.

Required service capabilities (proposed responsibilities, not locked URL names):

| Domain | Backend payload / operation needed |
|---|---|
| Assets | Stable ID, type, capacity with units, location, health, workload, maintenance, operating hours, assignments; validated create/update |
| Vessels | Identity, origin/destination, original/current ETA with timezone, priority, cargo type/units/workload, planned berth, crane assignments, handling estimate |
| Berths | Surveyed geometry, physical capacity, draft/cargo constraints, yard link, assigned cranes; create/update |
| Cranes | Capacity, type, compatible berth assignments, maintenance, health, availability; create/update |
| Weather | Current/forecast values, time/units/provider, location and operational exposure assessments |
| Congestion | Timestamped 6/12/24/48-hour series, berth queues, utilization, delay, confidence and model provenance |
| Alerts | Problem, severity, affected IDs, dependency graph, impact window and estimated consequences |
| Recommendations | Defined response catalogue, ranking, expected impact, resource compatibility and assumptions |
| Approvals | Authenticated actor, recommendation version, approve/modify/reject, required comment, idempotency and audit trail |
| Operational plan | Human-approved plan state, pending tasks and execution status; never inferred from a recommendation alone |

Forecasts, weather and impact values are demonstration scenarios, not predictions. Their presentation still needs mapping to actual backend payloads. The current generic record shape is deliberately small and should become distinct validated domain schemas during backend integration. Backend implementation must enforce authority, revision checks, validation and persistence independently of UI controls.

## Sources and asset provenance

- IBM template: https://github.com/drijesh-ppatel/bob-ai-hackathon-submission-template
- Port context: https://mopsw.nic.in/sagarvidyakosh/index.php?title=Deendayal_Port_Authority
- Home photograph: Deendayal Port Authority’s published OJ-07 photograph, https://x.com/Deendayal_Port/status/1652897833476046848
- Image source: https://pbs.twimg.com/media/FvBF0FfaEAE_tlK.jpg

The photo is credited in the interface. It is a third-party reference image, not an original project asset; no open-license or redistribution right has been verified. Review permission or replace it with team-owned/licensed port photography before distributing a public release.

## Known prototype limits

- Operational data, weather, forecasts, impacts and response rankings are simulated; models and live services are not integrated.
- The 3D quay is illustrative, not an accurate digital twin or navigational chart. New berth/crane records can be laid out illustratively; arbitrary real geometry and collision-aware equipment movements are not implemented.
- Register changes do not run a prediction engine or regenerate the predefined risk scenario.
- Approval records and plans are local demo records, not tamper-proof audit evidence. Modified free-text instructions are not re-evaluated by a backend.
- Vessel movement is an illustrative animation; no AIS or dispatch integration exists.
- Authentication, roles, multi-user updates, real-time transport and backend error mapping remain backend-integration work.
- The frontend uses some shared generic record fields; production schemas need explicit units and domain validation.
- Working frontend does not imply complete IBM Bob integration or a finished hackathon submission.

## Browser QA (2026-09-14)

Executed against the running local frontend using the in-app Chromium browser:

- All nine sidebar destinations, home entry, Settings and refresh navigation.
- 48-hour Live Port View selection and B03 detail drawer with dependency chain.
- Alert-to-review journey; modification requires a comment; confirmed modification creates a plan/record and survives reload.
- Crane create/edit (125 to 150 capacity), search and no-match empty state.
- Asset and berth creation; blank required-field submission stays in the form.
- Mobile 390×844 weather, navigation and vessel form layout; main document has no horizontal overflow.
- Simulated service failure, retry, empty register and no-alert state.
- Console inspected during review: no application errors observed.

Build and TypeScript checks are recorded in the task result. No real backend integration, real port data, model accuracy or operational execution was tested.
