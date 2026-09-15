## Presentation Structure

The PortSentinel Nexus submission contains exactly **5 slides**:

### Slide 1 — Problem

**One equipment issue can become a port bottleneck**

Explains:

- Reactive, not predictive — delays become visible after reaching berths/cranes.
- Risk tracked in silos — equipment health and weather are separated from congestion data.
- Small issues cascade — an at-risk asset can reduce capacity and increase vessel queues.

Visual story:

`Weather / Equipment → Asset Risk → Reduced Capacity → Vessel Delay → Queue Growth → Port Congestion`

Kandla/Deendayal Port is used as the reference setting. Port operations shown in the prototype are simulated and should not be interpreted as measured real-world congestion.

---

### Slide 2 — Solution

**See the bottleneck before it becomes congestion**

Core capabilities:

- **SEE** — Live Port View
- **PREDICT** — Alerts
- **DECIDE** — Approvals

Core workflow:

`Data → Prediction → Recommendation → Human Approval → Operational Plan`

The slide uses the actual PortSentinel Nexus product interface.

Operational plans are saved for review and are not automatically executed.

---

### Slide 3 — Demo / Architecture

**The documented system behind the product**

Technical stack and flow:

`Vessel + Weather + Asset / Berth Data`
→ `PortSentinel Nexus`
→ `Infrastructure Failure Risk`
+
`Congestion Prediction`
→ `Risk / Congestion Signal`
→ `Recommended Solution`
→ `Human Approval`
→ `Operational Plan`

Key technologies:

- React + Three.js frontend
- FastAPI backend
- SQLite persistence
- Supplied calibrated XGBoost classifier for infrastructure failure risk
- Deterministic berth-queue simulation for congestion estimation
- Groq for explaining backend findings

Important architecture constraints:

- The LLM explains backend findings only.
- Human approval remains explicit.
- Operational plans are not automatically executed.
- The congestion component is a deterministic queue simulation, not a trained ML congestion model.

---

### Slide 4 — IBM Technology Integration

**BOB assistance in software engineering**

BOB is presented as a **software-development / backend-engineering assistant**, not as the runtime decision-maker.

Intended engineering workflow:

`Requirement`
→ `BOB Assistance`
→ `Backend / API + Logic`
→ `Testing / Debugging / Validation`
→ `Integration`
→ `PortSentinel Nexus`

Potential engineering support areas include:

- Backend implementation
- API development
- Backend logic
- Testing
- Debugging
- Validation
- Integration
- Documentation

### IBM Integration Accuracy

The presentation does **not** claim that BOB-assisted development has been historically verified in the project documentation.

BOB's role shown in the presentation is an **intended engineering role**, not evidence of completed IBM-assisted development.

`watsonx` is **not implemented** and is therefore not presented as an implemented component.

BOB does **not**:

- predict port risk
- run congestion prediction
- make operational decisions
- approve operational plans
- directly control port operations

The configured runtime explanation provider is Groq.

---

### Slide 5 — Impact

**A path beyond the Kandla prototype**

The roadmap is:

`TODAY → PILOT → ENTERPRISE → SCALE`

#### TODAY — Prototype
Earlier bottleneck visibility by connecting risk with capacity and queue estimates.

#### PILOT — Planned
Validate the workflow with operators and actual equipment records.

#### ENTERPRISE — Planned
Integrate operational systems while retaining transparent source provenance.

#### SCALE — Planned
Adapt the configuration and workflow for additional ports.

### Vision

> “A decision system that helps operators see risk early, understand it, and approve the right action before congestion occurs.”

Current benefits represent prototype capabilities, **not measured field results**.

Pilot, enterprise, and scale stages are planned.

Port operations in the prototype are simulated; external Open-Meteo weather data is separately identified.
