/**
 * PortSentinel Nexus — Domain types / schemas
 * Reference environment: Deendayal Port (Kandla), Gujarat, India
 *
 * ALL data served by this module is SIMULATED.
 * No real SCADA, AIS, or private port terminal data is used.
 */

// ─── Shared ──────────────────────────────────────────────────────────────────

export type EntityStatus =
  | "Available"
  | "Occupied"
  | "Working"
  | "Restricted"
  | "At risk"
  | "Alongside"
  | "Waiting"
  | "Inbound"
  | "Maintenance"
  | "Offline";

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";
export type CargoCategoryType =
  | "Dry bulk"
  | "Container"
  | "Liquid bulk"
  | "General cargo"
  | "Multipurpose"
  | "Hazardous";

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface Asset {
  /** Unique asset identifier, e.g. "P03" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Asset category, e.g. "Power unit", "Reefer infrastructure" */
  type: string;
  /** Physical location or zone within port */
  location: string;
  /** Rated capacity in relevant unit */
  capacity: number;
  status: EntityStatus;
  /** Health index 0–100 (simulated) */
  healthIndex: number;
  /** Current workload percentage 0–100 (simulated) */
  workloadPct: number;
  /** ISO date of next scheduled maintenance */
  nextMaintenance: string;
  /** Operating hours logged (simulated) */
  operatingHours: number;
  /** Berth IDs that depend on this asset (dependency graph) */
  servesBerths: string[];
  /** Crane IDs that depend on this asset */
  servesCranes: string[];
  /** Free-text operational constraints */
  constraints: string;
  /** SIMULATED flag — always true for this layer */
  simulated: true;
}

// ─── Crane ───────────────────────────────────────────────────────────────────

export interface Crane {
  id: string;
  name: string;
  /** Crane sub-type, e.g. "Mobile harbour" */
  type: string;
  /** Berth ID where crane is currently stationed */
  assignedBerthId: string;
  /** Rated lift capacity in tonnes */
  liftCapacityT: number;
  status: EntityStatus;
  healthIndex: number;
  workloadPct: number;
  nextMaintenance: string;
  operatingHours: number;
  /** Asset IDs this crane depends on (e.g. power supply) */
  dependsOnAssets: string[];
  constraints: string;
  simulated: true;
}

// ─── Berth ───────────────────────────────────────────────────────────────────

export interface Berth {
  id: string;
  name: string;
  cargoCategory: CargoCategoryType;
  /** Physical location label within port */
  location: string;
  /** Maximum vessel length in metres */
  maxLengthM: number;
  /** Maximum draft in metres */
  maxDraftM: number;
  status: EntityStatus;
  healthIndex: number;
  workloadPct: number;
  nextMaintenance: string;
  /** IDs of cranes currently stationed at this berth */
  craneIds: string[];
  /** IDs of vessels currently alongside or assigned */
  vesselIds: string[];
  /** Asset IDs that serve this berth */
  assetIds: string[];
  constraints: string;
  simulated: true;
}

// ─── Vessel ──────────────────────────────────────────────────────────────────

export type VesselType =
  | "Bulk carrier"
  | "Container vessel"
  | "General cargo"
  | "Tanker"
  | "RORO";

export interface Vessel {
  id: string;
  name: string;
  type: VesselType;
  /** IMO number (simulated placeholder) */
  imoNumber: string;
  /** Flag state */
  flag: string;
  /** Deadweight tonnage */
  dwt: number;
  /** Length overall in metres */
  loaM: number;
  /** Draft in metres */
  draftM: number;
  status: EntityStatus;
  /** Port of origin */
  origin: string;
  destination: string;
  /** Planned berthing location berth ID (null if not yet assigned) */
  plannedBerthId: string | null;
  /** ETA as ISO-8601 string (simulated) */
  eta: string;
  /** Estimated berth departure as ISO-8601 string */
  etd: string;
  /** Estimated cargo handling duration in hours */
  handlingHours: number;
  /** Operational priority for berthing queue */
  priority: "Normal" | "High" | "Urgent";
  /** Crane IDs assigned for cargo operations */
  assignedCraneIds: string[];
  /** Flag set when vessel is the subject of an active alert */
  hasActiveAlert: boolean;
  constraints: string;
  simulated: true;
}

// ─── Operation ───────────────────────────────────────────────────────────────

export type OperationStatus =
  | "Active"
  | "Scheduled"
  | "Delayed"
  | "Completed"
  | "Cancelled";

export interface Operation {
  /** Unique operation ID */
  id: string;
  /** Human-readable label */
  label: string;
  status: OperationStatus;
  /** Vessel involved */
  vesselId: string;
  /** Berth where operation takes place */
  berthId: string;
  /** Cranes supporting this operation */
  craneIds: string[];
  /** Assets that must be operational for this to proceed */
  dependentAssetIds: string[];
  /** Planned start ISO-8601 */
  plannedStart: string;
  /** Planned end ISO-8601 */
  plannedEnd: string;
  /** Delay in hours from original schedule (0 = on time) */
  delayHours: number;
  riskLevel: RiskLevel;
  /** Reason for delay or risk (may be empty string) */
  riskNote: string;
  simulated: true;
}

// ─── Port State (composite root) ─────────────────────────────────────────────

export interface PortState {
  /** Snapshot timestamp ISO-8601 */
  snapshotAt: string;
  /** Data source label */
  dataSource: "SIMULATED";
  /** Reference port */
  portName: "Deendayal Port (Kandla)";
  /** Geographic coordinates */
  coordinates: { lat: number; lon: number };
  assets: Asset[];
  cranes: Crane[];
  berths: Berth[];
  vessels: Vessel[];
  operations: Operation[];
}
