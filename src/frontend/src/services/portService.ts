export type Register = "Assets" | "Vessels" | "Berths" | "Cranes";
export interface RecordItem {
  id: string;
  name: string;
  type: string;
  location: string;
  capacity: number;
  capacityUnit?: string;
  status: string;
  health: number;
  workload: number;
  maintenance: string;
  origin?: string;
  destination?: string;
  eta?: string;
  plannedEta?: string;
  priority?: string;
  assignedCranes?: string;
  handlingHours?: number;
  operatingHours?: number;
  constraints?: string;
  source?: string;
  cargoUnits?: number;
  handlingRate?: number;
  maxDraft?: number;
  draft?: number;
  length?: number;
  cargoType?: string;
  supplyAsset?: string | null;
  modelFeatures?: Record<string, number> | null;
  position?: { latitude: number; longitude: number } | null;
  speed?: number;
  heading?: number;
  imo?: string | null;
  mmsi?: string | null;
}
export interface Point {
  hour: number;
  congestion: number;
  queue: number;
  utilization: number;
}
export interface Scenario {
  id: string;
  name: string;
  detail: string;
  tasks: string[];
  resources: string;
  assumption: string;
  feasible: boolean;
  score: number;
  scoreBasis: string;
  delay: number;
  congestion: number;
  risk: string;
  affectedBerths: string[];
  affectedVessels: string[];
  metrics: {
    totalDelayHours: number;
    peakCongestion: number;
    peakQueue: number;
    resourceEffort: number;
  };
  series: Point[];
}
export interface Risk {
  status: string;
  class_1_probability?: number;
  risk_probability: number | null;
  risk_level?: string | null;
  threshold_band?: string;
  positive_class_confirmed?: boolean;
  note?: string;
  input_source?: string;
}
export interface Dependency {
  asset_id: string;
  crane_ids: string[];
  berth_ids: string[];
  vessel_ids: string[];
  workload_exposure: number;
  substitutes: string[];
  arrivals_within_6h: number;
  criticality: number;
  basis: string;
}
export interface Alert {
  id: string;
  severity: string;
  type: string;
  berth_id: string | null;
  asset_id: string | null;
  vessel_ids: string[];
  title: string;
  problem: string;
  impact: {
    congestion?: number;
    delayHours?: number;
    queue?: number;
    criticality?: number;
  };
  timeToImpactHours: number;
  dependency?: Dependency | null;
  risk?: Risk | null;
  source: string;
}
export interface BerthForecast {
  id: string;
  name: string;
  congestion: number;
  utilization: number;
  queue: number;
  delay: number;
  cranes: string[];
  capacity: number;
  capacityUnit: string;
  workload: number;
  schedule: {
    vessel_id: string;
    arrival: number;
    start: number;
    finish: number;
    delay: number;
    capacityUnavailable: boolean;
    reason: string | null;
  }[];
}
export interface Congestion {
  method: string;
  basis: string;
  source: string;
  weatherApplied: boolean;
  delayIsLowerBound: boolean;
  berths: BerthForecast[];
  series: Point[];
  totalDelayHours: number;
  averageDelayHours: number;
  peakCongestion: number;
  currentCongestion: number;
  waitingVessels: number;
}
export interface WeatherPoint {
  time: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  windKmh: number;
  windKnots: number;
  windDirection: number;
  windDirectionLabel?: string;
  visibilityKm: number;
  condition: string;
  rainProbability: number | null;
}
export interface Weather {
  status: string;
  source: string;
  current: WeatherPoint | null;
  forecast: WeatherPoint[];
  fetchedAt: string | null;
  summary: string;
  severe: string[];
  affectedAssets: string[];
  error?: string;
  stale: boolean;
}
export interface Explanation {
  status: string;
  provider: string;
  source: string;
  summary: string;
  error?: string;
  fact_ids?: string[];
}
export interface Decision {
  id: string;
  report_id?: string;
  solution: string;
  comment: string;
  status: "Approved" | "Modified" | "Rejected";
  at: string;
  actor?: string;
  scenario?: Scenario;
  plan?: {
    tasks: string[];
    operatorConditions: string;
    status: string;
    execution: string;
    metrics: Scenario["metrics"];
  } | null;
}
export interface Report {
  id: string;
  revision: number;
  at: string;
  simulationTime: string;
  source: string;
  risks: Record<string, Risk>;
  dependencies: Dependency[];
  congestion: Congestion;
  alerts: Alert[];
  primaryAlert: Alert | null;
  scenarios: Scenario[];
  recommended_id: string | null;
  explanation: Explanation;
  facts: Record<string, string>;
  model: {
    status: string;
    positiveClassConfirmed: boolean;
    compatibilityRecovery: boolean;
    features: string[];
    thresholds: { low: number; high: number };
    preprocessing: string;
    error: string | null;
  };
}
export interface Snapshot {
  registers: Record<Register, RecordItem[]>;
  decisions: Decision[];
  revision: number;
  report: Report;
  weather: Weather;
  audit: { id: number; at: string; event: string; details: unknown }[];
  services: {
    model: Report["model"];
    weather: string;
    llm: {
      provider: string;
      model?: string;
      status: string;
      missing: string[];
    };
  };
  simulationTime: string;
}
let cached: Snapshot | null = null;
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-PortSentinel-Client": "ui",
  };
  const token = sessionStorage.getItem("portsentinel-operator-token");
  if (token) headers["X-Operator-Token"] = token;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "The backend is unavailable. Start the API server and retry.",
    );
  }
  if (!response.ok) {
    let message = "The operation could not be completed.";
    try {
      const error = await response.json();
      message =
        typeof error.detail === "string"
          ? error.detail
          : JSON.stringify(error.detail);
    } catch {}
    throw new Error(message);
  }
  return response.json();
}
export const portService = {
  decide: (
    report_id: string,
    scenario_id: string,
    status: Decision["status"],
    comment: string,
    request_id: string,
  ) =>
    request("/approvals", {
      method: "POST",
      body: JSON.stringify({
        report_id,
        scenario_id,
        status,
        comment,
        request_id,
      }),
    }),
  async load(): Promise<Snapshot> {
    cached = await request<Snapshot>("/snapshot");
    return cached;
  },
  async save(snapshot: Snapshot): Promise<void> {
    if (!cached) throw new Error("Refresh the port state before saving.");
    if (snapshot.decisions.length > cached.decisions.length) {
      const decision = snapshot.decisions.at(-1)!;
      await request("/approvals", {
        method: "POST",
        body: JSON.stringify({
          report_id: cached.report.id,
          scenario_id: decision.solution,
          status: decision.status,
          comment: decision.comment,
          request_id: crypto.randomUUID(),
        }),
      });
      return;
    }
    const changed: Array<{
      domain: Register;
      row: RecordItem;
      exists: boolean;
    }> = [];
    for (const domain of [
      "Cranes",
      "Vessels",
      "Berths",
      "Assets",
    ] as Register[])
      for (const row of snapshot.registers[domain]) {
        const previous = cached.registers[domain].find((r) => r.id === row.id);
        if (JSON.stringify(previous) !== JSON.stringify(row))
          changed.push({ domain, row, exists: !!previous });
      }
    if (!changed.length) return;
    if (new Set(changed.map((c) => c.row.id)).size !== 1)
      throw new Error("Save one record at a time.");
    const change = changed[0];
    await request(
      `/${change.domain.toLowerCase()}${change.exists ? "/" + encodeURIComponent(change.row.id) : ""}`,
      {
        method: change.exists ? "PUT" : "POST",
        headers: { "If-Match": String(cached.revision) },
        body: JSON.stringify(change.row),
      },
    );
  },
  async simulate(event: "advance" | "degrade" | "repair" | "reset", hours = 6) {
    return request<Snapshot>("/simulation", {
      method: "POST",
      body: JSON.stringify({ event, hours }),
    });
  },
  async explain(id: string) {
    return request<Explanation>("/explanations", {
      method: "POST",
      body: JSON.stringify({ report_id: id }),
    });
  },
  async refreshWeather() {
    return request<Weather>("/weather?refresh=true");
  },
};
export async function resetDemo() {
  await portService.simulate("reset");
}
