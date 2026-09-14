# Solution overview

PortSentinel Nexus is a port-resilience decision-support prototype. An immersive home and interactive illustrative quay lead to operational analysis, editable registers and human-reviewed responses.

The backend owns data and calculations. It loads the team's supplied classifier, normalizes external weather, traverses asset → crane → berth → vessel dependencies, simulates handling queues, and evaluates do-nothing, repair, crane reassignment, vessel shift and combined responses. Every feasible response is scored by the same deterministic formula. Bob is reserved for arranging grounded explanations; it cannot change numbers, rank scenarios or authorize actions.

Operators compare outcomes in Alerts and Approvals, record reasoning and confirm an outcome. The backend persists the exact report, selected scenario, actor, timestamp, accepted plan and audit event. Modified responses select an evaluated alternative; free-text conditions are preserved for human follow-through and do not become simulated commands. Rejection does not accept a new plan.

The UI retains the locked module hierarchy. There is no new chatbot, analytics module or autonomous execution flow. Technical limitations, external-source provenance and simulation labels remain visible.
