# Problem Statement

## Background

Port operations connect vessel arrivals, berth availability, crane handling capacity, power infrastructure and weather. PortSentinel Nexus uses Deendayal Kandla Port, Gujarat, as its reference setting and combines L1 Container Congestion Predictor and Port Operations Optimiser with U1 Power Outage Prediction and Grid Equipment Failure Advisor.

## The Problem

Degraded equipment or power supply reduces handling capacity and increases vessel queues. An isolated equipment health score does not explain which berth will lose capacity, which vessels will wait, or whether repair, crane reassignment or vessel shifting would improve the outcome.

## Who is Affected

Terminal operations coordinators allocating berths and cranes, maintenance personnel reviewing equipment exposure, and supervisors approving responses to expected delays.

## Why It Matters

The same equipment issue can have different consequences depending on cargo demand, arrival pressure and substitute availability. Connecting these factors helps operators prioritize attention and compare responses. The prototype reports simulated delay and congestion metrics; it does not claim measured savings at a real port.

## Why Existing Solutions Fall Short

The workflow addressed here is fragmented review of equipment status and vessel schedules. Reviewing either separately does not establish the downstream effect of degraded capacity. This is the project's problem framing, not a claim that every commercial port system lacks these capabilities.

Private operational records are unavailable. Port operations are explicitly simulated; Open-Meteo weather is separately labeled. A human approves, modifies or rejects recommendations. No real equipment is controlled.
