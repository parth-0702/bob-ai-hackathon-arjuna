export type Register = "Assets" | "Vessels" | "Berths" | "Cranes";
export interface RecordItem {
  id: string;
  name: string;
  type: string;
  location: string;
  capacity: number;
  status: string;
  health: number;
  workload: number;
  maintenance: string;
  origin?: string;
  destination?: string;
  eta?: string;
  priority?: string;
  assignedCranes?: string;
  handlingHours?: number;
  operatingHours?: number;
  constraints?: string;
}
export interface Decision {
  id: string;
  solution: string;
  comment: string;
  status: "Approved" | "Modified" | "Rejected";
  at: string;
}
export interface Snapshot {
  registers: Record<Register, RecordItem[]>;
  decisions: Decision[];
}
const row = (
  id: string,
  name: string,
  type: string,
  location: string,
  capacity: number,
  status = "Available",
  health = 94,
  workload = 52,
): RecordItem => ({
  id,
  name,
  type,
  location,
  capacity,
  status,
  health,
  workload,
  maintenance: "2026-09-21",
  origin: "Mundra",
  destination: "Kandla",
  eta: "2026-09-14T14:00",
  priority: "Normal",
  assignedCranes:
    location === "B03" ? "C07" : location === "B01" ? "C01" : "C04",
  handlingHours: 8,
  operatingHours: 1240,
  constraints: "Subject to operator capacity and compatibility checks",
});
export const seed: Snapshot = {
  registers: {
    Assets: [
      row(
        "P03",
        "East quay power unit",
        "Power unit",
        "B03",
        2400,
        "At risk",
        61,
        87,
      ),
      row("R01", "Reefer zone north", "Reefer infrastructure", "Yard A", 180),
      row("CS02", "Cold storage east", "Cold storage", "Yard B", 600),
      row("C07", "Harbour crane 07", "Crane", "B03", 100, "Restricted", 68, 89),
    ],
    Vessels: [
      row("V01", "MV Sagar Pearl", "Bulk carrier", "B01", 18500, "Alongside"),
      row(
        "V02",
        "MV Arabian Star",
        "Container vessel",
        "B02",
        1240,
        "Alongside",
      ),
      row(
        "V03",
        "MV Kutch Voyager",
        "Bulk carrier",
        "B03",
        22000,
        "Alongside",
        90,
        82,
      ),
      row(
        "V04",
        "MV Ocean Meridian",
        "Container vessel",
        "Anchorage",
        980,
        "Waiting",
      ),
      row("V05", "MV Narmada", "General cargo", "Inbound", 8600, "Inbound"),
    ],
    Berths: [
      row(
        "B01",
        "West cargo quay",
        "Dry bulk",
        "West quay",
        225,
        "Occupied",
        96,
        61,
      ),
      row(
        "B02",
        "Container quay",
        "Container",
        "Central quay",
        260,
        "Occupied",
        91,
        74,
      ),
      row(
        "B03",
        "East cargo quay",
        "Multipurpose",
        "East quay",
        240,
        "At risk",
        72,
        91,
      ),
      row(
        "B04",
        "Outer cargo quay",
        "Multipurpose",
        "Outer quay",
        280,
        "Available",
        97,
        28,
      ),
    ],
    Cranes: [
      row("C01", "Harbour crane 01", "Mobile harbour", "B01", 100, "Working"),
      row("C04", "Harbour crane 04", "Mobile harbour", "B02", 125, "Working"),
      row(
        "C07",
        "Harbour crane 07",
        "Mobile harbour",
        "B03",
        100,
        "Restricted",
        68,
        89,
      ),
      row(
        "C09",
        "Harbour crane 09",
        "Mobile harbour",
        "B04",
        125,
        "Available",
        97,
        28,
      ),
    ],
  },
  decisions: [],
};
const KEY = "portsentinel-demo-v1";
export interface PortService {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<void>;
}
// Replace this adapter with authenticated backend calls. UI components never fetch or own fixtures.
export const portService: PortService = {
  async load() {
    const params = new URLSearchParams(location.search);
    await new Promise((r) =>
      setTimeout(r, params.get("state") === "loading" ? 3000 : 350),
    );
    if (params.get("state") === "error")
      throw new Error("The operations service is unavailable. Please retry.");
    if (params.get("state") === "empty")
      return {
        registers: { Assets: [], Vessels: [], Berths: [], Cranes: [] },
        decisions: [],
      };
    const saved = localStorage.getItem(KEY);
    if (saved) {
      try {
        const value = JSON.parse(saved);
        if (!value.registers || !Array.isArray(value.decisions)) throw Error();
        for (const key of ["Assets", "Vessels", "Berths", "Cranes"])
          if (
            !Array.isArray(value.registers[key]) ||
            value.registers[key].some(
              (r: RecordItem) =>
                !r ||
                typeof r.id !== "string" ||
                typeof r.name !== "string" ||
                typeof r.location !== "string" ||
                typeof r.capacity !== "number" ||
                typeof r.health !== "number" ||
                typeof r.workload !== "number",
            )
          )
            throw Error();
        return value;
      } catch {
        throw new Error(
          "Saved demo data could not be read. Reset demo data in Settings.",
        );
      }
    }
    return structuredClone(seed);
  },
  async save(snapshot) {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  },
};
export function resetDemo() {
  localStorage.removeItem(KEY);
}
export const solutions = [
  {
    id: "S1",
    name: "Reassign C09 to berth B03",
    detail:
      "Transfer the available harbour crane from B04; schedule a power inspection before the next handling window.",
    delay: 1.8,
    congestion: 31,
    resources: "C09 · electrical inspection crew",
    risk: "Low",
    assumption:
      "B04 remains free for the next 6 hours; crane travel route is clear.",
  },
  {
    id: "S2",
    name: "Shift the next vessel to B04",
    detail:
      "Retain current crane assignments and redirect Ocean Meridian to the outer quay.",
    delay: 1.2,
    congestion: 22,
    resources: "B04 · pilot · two tugs",
    risk: "Moderate",
    assumption: "Vessel draft and cargo are compatible with B04.",
  },
  {
    id: "S3",
    name: "Resequence the arrival window",
    detail:
      "Hold Ocean Meridian at anchorage until the inspection is complete.",
    delay: 0.4,
    congestion: 12,
    resources: "Vessel agent · scheduling team",
    risk: "Moderate",
    assumption: "The vessel operator accepts a revised arrival window.",
  },
];
