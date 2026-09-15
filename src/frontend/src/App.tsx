import { lazy, Suspense, useEffect, useState } from "react";
import {
  Anchor,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Clock,
  CloudSun,
  Compass,
  Container,
  Construction as Crane,
  Expand,
  Layers,
  MapPin,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  SlidersHorizontal,
  TriangleAlert,
  Waves,
  X,
  Wind,
} from "lucide-react";
import {
  AlertsPanel,
  ApprovalsPanel,
  BackendSettings,
} from "./components/ConnectedOperations";
import WeatherPanel from "./components/WeatherPanel";
import CongestionPanel from "./components/CongestionPanel";
import { Badge, Forecast } from "./components/OperationalUI";
const PortScene = lazy(() => import("./components/PortScene"));
import {
  portService,
  type Snapshot,
  type Register,
  type RecordItem,
} from "./services/portService";
const modules = [
  "Live Port View",
  "Alerts",
  "Approvals",
  "Congestion",
  "Weather",
  "Assets",
  "Vessels",
  "Berths",
  "Cranes",
] as const;
type Page = (typeof modules)[number] | "Home" | "Settings";
const icons = [
  Compass,
  Bell,
  ShieldCheck,
  Layers,
  CloudSun,
  Container,
  Ship,
  Anchor,
  Crane,
];
const descriptions: Record<string, string> = {
  Alerts: "Understand the problem. See the impact. Choose a response.",
  Approvals: "Operational decisions stay in human hands.",
  Congestion: "See how pressure builds across berths and handling resources.",
  Weather: "Conditions that matter to your next operational decision.",
  Assets: "Infrastructure health, availability and operational dependencies.",
  Vessels: "Arrival schedules and cargo demand, in one operational register.",
  Berths: "Configure quay capacity and operational constraints.",
  Cranes: "Manage handling capacity and berth assignments.",
};
const getPage = (): Page => {
  const name = decodeURIComponent(location.hash.slice(1));
  return [...modules, "Settings"].includes(name) ? (name as Page) : "Home";
};
export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [horizon, setHorizon] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [edit, setEdit] = useState<RecordItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    setConfirmDelete(false);
    setDeleteError("");
  }, [edit?.id, isNew, page]);
  const [solution, setSolution] = useState("S1");
  const [toast, setToast] = useState("");
  const [decision, setDecision] = useState<
    "Approved" | "Modified" | "Rejected" | null
  >(null);
  useEffect(() => {
    if (!edit && !selected && !decision) return;
    const before = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector("[role=dialog]");
      const focusable = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),textarea,select,a[href]",
        ) || [],
      );
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      before?.focus();
    };
  }, [!!edit, !!selected, !!decision]);
  const load = () => {
    setLoading(true);
    setError("");
    portService
      .load()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    const listener = () => {
      setPage(getPage());
      setQuery("");
      setFilter("All statuses");
      setSelected(null);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEdit(null);
        setSelected(null);
        setDecision(null);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  function go(p: Page) {
    location.hash = p === "Home" ? "" : encodeURIComponent(p);
    setPage(p);
    setMenu(false);
    setQuery("");
    setFilter("All statuses");
    setSelected(null);
  }
  async function persist(next: Snapshot, message: string) {
    setSaving(true);
    try {
      await portService.save(next);
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  const refresh = async () => {
    setData(await portService.load());
  };
  useEffect(() => {
    setSolution(
      data?.report.recommended_id || data?.report.scenarios[0]?.id || "",
    );
  }, [data?.report.id]);
  const latest = data?.decisions.find((d) => d.report_id === data.report.id);
  const handled = !!latest || !data?.report.alerts.length;
  const emptyPort = Object.values(data?.registers || {}).every(
    (rows) => rows.length === 0,
  );
  const register = ["Assets", "Vessels", "Berths", "Cranes"].includes(page)
    ? (page as Register)
    : null;
  const item = selected
    ? (Object.values(data?.registers || {})
        .flat()
        .find((r: RecordItem) => r.id === selected) as RecordItem | undefined)
    : undefined;
  const berthDetail = data?.report.congestion.berths.find(
    (b) =>
      b.id === selected ||
      b.id === item?.location ||
      b.cranes.includes(selected || ""),
  );
  const dependencyDetail = data?.report.dependencies.find(
    (d) =>
      d.asset_id === selected ||
      d.berth_ids.includes(selected || "") ||
      d.crane_ids.includes(selected || "") ||
      d.vessel_ids.includes(selected || ""),
  );
  const scenePage = page === "Home" || page === "Live Port View";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => go("Home")}
          aria-label="PortSentinel home"
        >
          <span className="brand-mark">
            <Anchor size={25} />
          </span>
          <span>
            PORTSENTINEL<small>N E X U S</small>
          </span>
        </button>
        <div className="port-id">
          <MapPin size={14} />
          <span>
            DEENDAYAL PORT<small>Kandla, Gujarat · India</small>
          </span>
          <span className="dot" />
        </div>
        <div className="nav-label">COMMAND CENTER</div>
        <nav aria-label="Main navigation">
          <div className="primary-nav">
            {modules.slice(0, 3).map((m, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={m}
                  className={`primary-card ${page === m ? "active" : ""}`}
                  onClick={() => go(m)}
                >
                  <span className="nav-icon">
                    <Icon size={21} />
                    {i === 1 && !handled && <em />}
                  </span>
                  <span>
                    {m}
                    <small>
                      {
                        [
                          "Your port, in perspective",
                          "Predict. Investigate. Respond.",
                          "Review operational decisions",
                        ][i]
                      }
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </div>
          <div className="nav-label">OPERATIONS</div>
          {modules.slice(3, 5).map((m, i) => {
            const Icon = icons[i + 3];
            return (
              <button
                className={`nav-item ${page === m ? "active" : ""}`}
                key={m}
                onClick={() => go(m)}
              >
                <Icon size={18} />
                {m}
              </button>
            );
          })}
          <div className="nav-label">PORT CONFIGURATION</div>
          {modules.slice(5).map((m, i) => {
            const Icon = icons[i + 5];
            return (
              <button
                className={`nav-item ${page === m ? "active" : ""}`}
                key={m}
                onClick={() => go(m)}
              >
                <Icon size={18} />
                {m}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="simulation">
            <span className="dot amber" />
            <span>
              SIMULATION ENVIRONMENT<small>No live terminal connection</small>
            </span>
          </div>
          <button className="nav-item" onClick={() => go("Settings")}>
            <Settings size={17} />
            Settings
          </button>
          <div className="operator">
            <span>OP</span>
            <div>
              Port operator<small>Demo workspace</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <main className={scenePage ? "scene-main" : ""}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>WORKSPACE</span>
            <ChevronRight size={12} />
            <b>{page === "Home" ? "Port overview" : page}</b>
          </div>
          <div className="top-right">
            <span className="local-time">
              <Clock size={13} />{" "}
              {data
                ? new Date(data.simulationTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }) + " IST · SIM"
                : "Connecting"}
            </span>
            <Badge tone="neutral">SIMULATED DATA</Badge>
            <button
              className="icon-button"
              aria-label="Refresh port data"
              onClick={async () => {
                try {
                  await refresh();
                  setToast("Port snapshot refreshed.");
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <RotateCcw size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => go("Alerts")}
              aria-label="Open alerts"
            >
              <Bell size={18} />
              {!handled && <i />}
            </button>
            <span className="avatar">OP</span>
          </div>
        </header>
        {loading ? (
          <div className="state">
            <span className="loader" />
            <h2>Preparing your port workspace</h2>
            <p>Loading the simulated operations snapshot…</p>
          </div>
        ) : error ? (
          <div className="state">
            <TriangleAlert />
            <h2>Unable to load operations</h2>
            <p role="alert">{error}</p>
            <button className="btn primary" onClick={load}>
              Retry connection
            </button>
          </div>
        ) : (
          data && (
            <>
              {scenePage ? (
                <section
                  className={`port-stage ${page === "Home" ? "home-stage" : ""}`}
                >
                  <>
                    {page === "Home" ? (
                      <div className={`photo-scene ${paused ? "paused" : ""}`}>
                        <img
                          src="/images/kandla-jetty.jpg"
                          alt="Tanker and tugboats alongside Deendayal Port’s OJ-07 jetty, in a port-authority archival photograph"
                        />
                      </div>
                    ) : (
                      <Suspense
                        fallback={
                          <div className="state">
                            Loading interactive port scene…
                          </div>
                        }
                      >
                        <PortScene
                          records={data.registers}
                          congestion={data.report.congestion}
                          onSelect={(id) => setSelected(id)}
                          active={page === "Live Port View"}
                          horizon={horizon}
                          paused={paused}
                          reset={reset}
                        />
                      </Suspense>
                    )}
                  </>
                  <div className="scene-vignette" />
                  <div className="scene-heading">
                    <div className="eyebrow">
                      <span className="dot" /> INDIA'S WESTERN GATEWAY
                    </div>
                    <h1>
                      {page === "Home" ? (
                        <>
                          A port that never stops.
                          <br />
                          <span>Ahead of what comes next.</span>
                        </>
                      ) : (
                        "Live Port View"
                      )}
                    </h1>
                    <p>
                      {page === "Home"
                        ? "Deendayal Port · Kandla Creek · Gulf of Kutch"
                        : "One connected view of vessels, infrastructure and operational risk."}
                    </p>
                    {page === "Home" && (
                      <button
                        className="btn light"
                        onClick={() => go("Live Port View")}
                      >
                        Enter port operations <ArrowRight size={17} />
                      </button>
                    )}
                  </div>
                  <div className="scene-weather">
                    <CloudSun size={26} />
                    <div>
                      <b>
                        {data.weather.current
                          ? `${Math.round(data.weather.current.temperature)}°`
                          : "—"}
                      </b>
                      <span>
                        {data.weather.current?.condition || "Unavailable"}
                      </span>
                    </div>
                    <i />
                    <div>
                      <Wind size={15} />
                      <span>
                        {data.weather.current
                          ? `${data.weather.current.windKnots.toFixed(1)} kn`
                          : "Weather unavailable"}
                      </span>
                    </div>
                    <small>
                      OPEN-METEO · {data.weather.status.toUpperCase()}
                    </small>
                  </div>
                  <div className="compass">
                    <span>N</span>
                    <Compass size={34} />
                    <small>23.03° N / 70.22° E</small>
                  </div>
                  <div className="scene-tools">
                    <button
                      className="icon-button"
                      title="Reset camera"
                      style={page === "Home" ? { display: "none" } : undefined}
                      aria-label="Reset camera"
                      onClick={() => setReset((r) => r + 1)}
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={
                        paused
                          ? "Resume scene movement"
                          : "Pause scene movement"
                      }
                      onClick={() => setPaused(!paused)}
                    >
                      {paused ? <Play size={18} /> : <Pause size={18} />}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Toggle fullscreen"
                      onClick={() => {
                        if (document.fullscreenElement)
                          document
                            .exitFullscreen()
                            .catch(() => setToast("Fullscreen unavailable"));
                        else
                          document.documentElement
                            .requestFullscreen()
                            .catch(() => setToast("Fullscreen unavailable"));
                      }}
                    >
                      <Expand size={18} />
                    </button>
                  </div>
                  {page === "Home" ? (
                    <div className="home-bottom">
                      <div className="location-caption">
                        <span className="line" />
                        <div>
                          THE PORT. THE PEOPLE. THE POSSIBILITIES.
                          <small>
                            Infrastructure intelligence, with the operator in
                            control.
                          </small>
                        </div>
                      </div>
                      <button
                        className="watch-card"
                        onClick={() => go("Alerts")}
                      >
                        <span className="watch-icon">
                          <TriangleAlert size={19} />
                        </span>
                        <div>
                          <small>ON THE OPERATIONAL HORIZON</small>
                          <b>
                            {data.report.primaryAlert?.title ||
                              "No operational alerts"}
                          </b>
                          <span>
                            Explore the developing risk{" "}
                            <ArrowUpRight size={14} />
                          </span>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="berth-strip">
                        {data.registers.Berths.length ? (
                          data.registers.Berths.map((b, i) => (
                            <button
                              key={b.id}
                              onClick={() => setSelected(b.id)}
                              className={selected === b.id ? "selected" : ""}
                            >
                              <span>
                                <i
                                  className={`dot ${i === 2 ? "amber" : ""}`}
                                />
                                {b.id}
                              </span>
                              <b>{b.name}</b>
                              <small>
                                {b.status}{" "}
                                <span>
                                  {data.report.congestion.berths.find(
                                    (row) => row.id === b.id,
                                  )?.utilization ?? 0}
                                  % load
                                </span>
                              </small>
                            </button>
                          ))
                        ) : (
                          <p>No berths configured. Add one in Berths.</p>
                        )}
                      </div>
                      <div className="timeline">
                        <div>
                          <Radio size={16} />
                          <b>
                            {horizon
                              ? "Forecast perspective"
                              : "Current perspective"}
                          </b>
                          <small>Illustrative scenario</small>
                        </div>
                        <div className="segmented">
                          {[0, 24, 48].map((h) => (
                            <button
                              className={horizon === h ? "active" : ""}
                              key={h}
                              onClick={() => setHorizon(h)}
                            >
                              {h === 0 ? "Now" : `+${h} hours`}
                            </button>
                          ))}
                        </div>
                        <span className="drag-hint">
                          Drag to orbit · Scroll to zoom
                        </span>
                      </div>
                    </>
                  )}
                  <div className="scene-disclaimer">
                    {page === "Home" ? (
                      <>
                        ARCHIVAL PHOTOGRAPH · OJ-07, KANDLA ·{" "}
                        <a
                          href="https://x.com/Deendayal_Port/status/1652897833476046848"
                          target="_blank"
                          rel="noreferrer"
                        >
                          DEENDAYAL PORT AUTHORITY ↗
                        </a>{" "}
                        · NOT A LIVE FEED
                      </>
                    ) : (
                      <>
                        ILLUSTRATIVE PORT LAYOUT · SIMULATED VESSELS & TELEMETRY
                      </>
                    )}
                  </div>
                </section>
              ) : (
                <div className="content">
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        DEENDAYAL PORT / OPERATIONS WORKSPACE
                      </div>
                      <h1>{page}</h1>
                      <p>
                        {descriptions[page] ||
                          "Workspace preferences and data provenance."}
                      </p>
                    </div>
                    {register && (
                      <button
                        className="btn primary"
                        onClick={() => {
                          setIsNew(true);
                          setEdit({
                            id: "",
                            name: "",
                            type: "",
                            location: "",
                            capacity: 1,
                            status: "Available",
                            health: 100,
                            workload: 0,
                            maintenance: new Date().toISOString().slice(0, 10),
                            origin: "",
                            destination: "Kandla",
                            eta: new Date().toISOString().slice(0, 16),
                            priority: "Normal",
                            assignedCranes: "",
                            handlingHours: 8,
                            operatingHours: 0,
                            constraints: "",
                          });
                        }}
                      >
                        <Plus size={17} />
                        Add{" "}
                        {register === "Vessels"
                          ? "vessel"
                          : register === "Berths"
                            ? "berth"
                            : register === "Cranes"
                              ? "crane"
                              : "asset"}
                      </button>
                    )}
                  </div>
                  {page === "Alerts" && (
                    <AlertsPanel
                      data={data}
                      solution={solution}
                      setSolution={setSolution}
                      onReview={() => go("Approvals")}
                    />
                  )}
                  {page === "Approvals" && (
                    <ApprovalsPanel
                      data={data}
                      solution={solution}
                      setSolution={setSolution}
                      onSaved={refresh}
                      onMessage={setToast}
                    />
                  )}
                  {page === "Congestion" && (
                    <CongestionPanel
                      data={data}
                      horizon={horizon}
                      setHorizon={setHorizon}
                      setSelected={setSelected}
                    />
                  )}
                  {page === "Weather" && (
                    <WeatherPanel
                      weather={data.weather}
                      setSelected={setSelected}
                      onRefresh={async () => {
                        try {
                          await portService.refreshWeather();
                          await refresh();
                        } catch (e) {
                          setToast((e as Error).message);
                        }
                      }}
                    />
                  )}
                  {register && (
                    <>
                      <div className="register-toolbar">
                        <label className="search">
                          <Search size={17} />
                          <input
                            aria-label={`Search ${register.toLowerCase()}`}
                            placeholder={`Search ${register.toLowerCase()} by name, ID or location…`}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                        <label className="status-filter">
                          <SlidersHorizontal size={16} />
                          <select
                            aria-label="Filter by status"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                          >
                            <option>All statuses</option>
                            {Array.from(
                              new Set(
                                data.registers[register].map((r) => r.status),
                              ),
                            ).map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <span>{data.registers[register].length} records</span>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>
                                {register === "Vessels"
                                  ? "Vessel / identity"
                                  : `${register.slice(0, -1)} / identity`}
                              </th>
                              <th>Type</th>
                              <th>
                                {register === "Cranes"
                                  ? "Assigned berth"
                                  : "Location / assignment"}
                              </th>
                              <th>
                                Capacity{" "}
                                {register === "Berths"
                                  ? "(m)"
                                  : register === "Cranes"
                                    ? "(t)"
                                    : ""}
                              </th>
                              <th>Status</th>
                              <th>
                                {register === "Vessels" ? "Workload" : "Health"}
                              </th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {data.registers[register]
                              .filter(
                                (r) =>
                                  `${r.name} ${r.id} ${r.location}`
                                    .toLowerCase()
                                    .includes(query.toLowerCase()) &&
                                  (filter === "All statuses" ||
                                    filter === r.status),
                              )
                              .map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    <button
                                      className="table-link identity"
                                      onClick={() => setSelected(r.id)}
                                    >
                                      <span className="record-icon">
                                        {register === "Vessels" ? (
                                          <Ship size={20} />
                                        ) : register === "Cranes" ? (
                                          <Crane size={20} />
                                        ) : register === "Berths" ? (
                                          <Anchor size={20} />
                                        ) : (
                                          <Container size={20} />
                                        )}
                                      </span>
                                      <span>
                                        {r.name}
                                        <small>{r.id}</small>
                                      </span>
                                    </button>
                                  </td>
                                  <td>{r.type}</td>
                                  <td>{r.location}</td>
                                  <td>{r.capacity.toLocaleString()}</td>
                                  <td>
                                    <Badge
                                      tone={
                                        [
                                          "At risk",
                                          "Restricted",
                                          "Waiting",
                                        ].includes(r.status)
                                          ? "amber"
                                          : "green"
                                      }
                                    >
                                      {r.status}
                                    </Badge>
                                  </td>
                                  <td>
                                    {register === "Vessels"
                                      ? r.workload
                                      : r.health}
                                    %
                                  </td>
                                  <td>
                                    <button
                                      className="btn small"
                                      onClick={() => {
                                        setEdit({ ...r });
                                        setIsNew(false);
                                      }}
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {!data.registers[register].some(
                          (r) =>
                            `${r.name} ${r.id} ${r.location}`
                              .toLowerCase()
                              .includes(query.toLowerCase()) &&
                            (filter === "All statuses" || filter === r.status),
                        ) && (
                          <div className="empty-inline">
                            <Search size={30} />
                            <h3>No matching {register.toLowerCase()}</h3>
                            <p>
                              {query || filter !== "All statuses"
                                ? "Try a different search or status filter."
                                : "Add your first record to configure the port."}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="fine-print">
                        Simulated register · changes are persisted by the
                        backend. Capacity units depend on asset type; vessel
                        capacity reflects its cargo units.{" "}
                        {register === "Berths" || register === "Cranes"
                          ? "Live operational status is available in Live Port View."
                          : ""}
                      </p>
                    </>
                  )}
                  {page === "Settings" && (
                    <BackendSettings
                      data={data}
                      onSaved={refresh}
                      onMessage={setToast}
                    />
                  )}
                </div>
              )}
            </>
          )
        )}
        <footer className="workspace-footer">
          <span>
            <span className="dot" /> PORTSENTINEL NEXUS <i>/</i> Decision
            support, with human control.
          </span>
          <span>
            IBM BOBATHON 2026 <i>·</i> PROTOTYPE
          </span>
        </footer>
      </main>
      {selected && data && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <section
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Operational details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <div className="eyebrow">OPERATIONAL DETAIL</div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>
              {selected} <span>/{item?.name || "Port resource"}</span>
            </h2>
            <Badge tone={item?.health && item.health < 75 ? "amber" : "green"}>
              {item?.status || "Available"}
            </Badge>
            <p className="fine-print">Simulated operational information</p>
            <dl className="detail-list">
              <div>
                <dt>Assignment</dt>
                <dd>{item?.location || "East quay"}</dd>
              </div>
              <div>
                <dt>Health / utilization</dt>
                <dd>
                  {item?.health ?? "—"}% / {item?.workload ?? "—"}%
                </dd>
              </div>
              <div>
                <dt>Congestion / queue</dt>
                <dd>
                  {berthDetail
                    ? `${berthDetail.congestion}% / ${berthDetail.queue} vessels`
                    : "No berth forecast"}
                </dd>
              </div>
              <div>
                <dt>Expected delay</dt>
                <dd>
                  {berthDetail
                    ? `${berthDetail.delay} hours average`
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd>
                  {item?.capacity ?? 0}{" "}
                  {selected.startsWith("B")
                    ? "m"
                    : selected.startsWith("C")
                      ? "t"
                      : "units"}
                </dd>
              </div>
              {selected.startsWith("V") && (
                <>
                  <div>
                    <dt>Origin → destination</dt>
                    <dd>
                      {item?.origin || "Not specified"} →{" "}
                      {item?.destination || "Kandla"}
                    </dd>
                  </div>
                  <div>
                    <dt>Current ETA</dt>
                    <dd>
                      {item?.eta?.replace("T", " ") || "Not specified"} IST
                    </dd>
                  </div>
                  <div>
                    <dt>Priority / handling</dt>
                    <dd>
                      {item?.priority || "Normal"} / {item?.handlingHours || 8}{" "}
                      hours
                    </dd>
                  </div>
                  <div>
                    <dt>Assigned cranes</dt>
                    <dd>{item?.assignedCranes || "Unassigned"}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Dependencies</dt>
                <dd>
                  {dependencyDetail
                    ? [
                        dependencyDetail.asset_id,
                        ...dependencyDetail.crane_ids,
                        ...dependencyDetail.berth_ids,
                        ...dependencyDetail.vessel_ids,
                      ].join(" → ")
                    : "No dependency identified"}
                </dd>
              </div>
              <div>
                <dt>Available cranes</dt>
                <dd>
                  {dependencyDetail?.substitutes.join(" · ") ||
                    "No eligible substitute identified"}
                </dd>
              </div>
            </dl>
            <div className="section-heading">
              <h3>Risk & congestion outlook</h3>
              <div className="segmented">
                {[24, 48].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={(horizon || 24) === h ? "active" : ""}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <Forecast
              horizon={horizon || 24}
              series={data.report.congestion.series}
            />
            <p>
              Capacity loss can extend handling time and push waiting vessels
              into the next berth window.
            </p>
            <button className="btn primary" onClick={() => go("Alerts")}>
              Investigate operational risk <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
      {edit && register && data && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
            onSubmit={async (e) => {
              e.preventDefault();
              if (confirmDelete || saving) return;
              if (
                !edit.name.trim() ||
                !edit.type.trim() ||
                !edit.location.trim() ||
                !edit.id.trim()
              ) {
                setToast("Enter a name, type, ID and location.");
                return;
              }
              if (
                data.registers[register].some(
                  (r) => r.id.toUpperCase() === edit.id.trim().toUpperCase(),
                ) &&
                isNew
              ) {
                setToast("That ID already exists. Choose a unique ID.");
                return;
              }
              const normalized = {
                ...edit,
                id: edit.id.trim().toUpperCase(),
                name: edit.name.trim(),
              };
              const rows = isNew
                ? [...data.registers[register], normalized]
                : data.registers[register].map((r) =>
                    r.id === edit.id ? normalized : r,
                  );
              const registers = { ...data.registers, [register]: rows };
              if (register === "Cranes")
                registers.Assets = registers.Assets.map((r) =>
                  r.id === edit.id ? { ...r, ...edit } : r,
                );
              if (
                register === "Assets" &&
                registers.Cranes.some((r) => r.id === edit.id)
              )
                registers.Cranes = registers.Cranes.map((r) =>
                  r.id === edit.id ? { ...r, ...edit } : r,
                );
              if (await persist({ ...data, registers }, `${edit.name} saved`))
                setEdit(null);
            }}
          >
            <div className="section-heading">
              <h2 id="form-title">
                {isNew ? "Add" : "Edit"}{" "}
                {register === "Vessels"
                  ? "vessel"
                  : register.slice(0, -1).toLowerCase()}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close form"
                onClick={() => setEdit(null)}
              >
                <X size={19} />
              </button>
            </div>
            <p>Update the simulated port register.</p>
            <div className="form-grid">
              {(["id", "name", "type", "location"] as const).map((key, i) => (
                <label className="field" key={key}>
                  {
                    {
                      id: "Unique ID",
                      name: "Name",
                      type: "Type",
                      location:
                        register === "Cranes"
                          ? "Assigned berth"
                          : "Location / assignment",
                    }[key]
                  }
                  <input
                    autoFocus={i === 0}
                    required
                    pattern={key === "id" ? "[A-Za-z0-9-]+" : undefined}
                    maxLength={80}
                    disabled={key === "id" && !isNew}
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {(["capacity", "health", "workload"] as const).map((key) => (
                <label className="field" key={key}>
                  {key === "capacity"
                    ? "Capacity"
                    : key === "health"
                      ? "Health (%)"
                      : "Workload (%)"}
                  <input
                    required
                    type="number"
                    min={key === "capacity" ? 1 : 0}
                    max={key === "capacity" ? 10000000 : 100}
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <label className="field">
                Status
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                >
                  {[
                    "Available",
                    "Working",
                    "Occupied",
                    "At risk",
                    "Restricted",
                    "Alongside",
                    "Waiting",
                    "Inbound",
                    "Maintenance",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {register === "Cranes" && (
                <div className="field">
                  <button
                    type="button"
                    className={
                      edit.status === "Maintenance" ? "btn danger" : "btn"
                    }
                    aria-pressed={edit.status === "Maintenance"}
                    onClick={() =>
                      setEdit({
                        ...edit,
                        status:
                          edit.status === "Maintenance"
                            ? "Available"
                            : "Maintenance",
                      })
                    }
                  >
                    Under maintenance:{" "}
                    {edit.status === "Maintenance" ? "On" : "Off"}
                  </button>
                  <p className="fine-print">
                    Save to apply. While on, this crane cannot handle vessels or
                    be reassigned. Existing vessel assignments will be cleared.
                    Turning it off makes the crane available; old assignments
                    are not restored.
                  </p>
                </div>
              )}
              {register === "Vessels" && (
                <>
                  {(["origin", "destination", "assignedCranes"] as const).map(
                    (key) => (
                      <label className="field" key={key}>
                        {
                          {
                            origin: "Origin",
                            destination: "Destination",
                            assignedCranes: "Assigned cranes",
                          }[key]
                        }
                        <input
                          required
                          value={edit[key] || ""}
                          onChange={(e) =>
                            setEdit({ ...edit, [key]: e.target.value })
                          }
                        />
                      </label>
                    ),
                  )}
                  <label className="field">
                    Current ETA (IST)
                    <input
                      required
                      type="datetime-local"
                      value={
                        edit.eta
                          ? new Date(new Date(edit.eta).getTime() + 330 * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEdit({ ...edit, eta: e.target.value + ":00+05:30" })
                      }
                    />
                  </label>
                  <label className="field">
                    Priority
                    <select
                      value={edit.priority || "Normal"}
                      onChange={(e) =>
                        setEdit({ ...edit, priority: e.target.value })
                      }
                    >
                      <option>Normal</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </label>
                  <label className="field">
                    Expected handling (hours)
                    <input
                      type="number"
                      min="1"
                      max="240"
                      required
                      value={edit.handlingHours ?? 8}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          handlingHours: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </>
              )}
              {register !== "Vessels" && (
                <>
                  <label className="field">
                    Operating hours
                    <input
                      type="number"
                      min="0"
                      required
                      value={edit.operatingHours ?? 0}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          operatingHours: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    {register === "Berths"
                      ? "Constraints / connected yard"
                      : "Operational constraints"}
                    <input
                      value={edit.constraints || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, constraints: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              {(register === "Vessels"
                ? ["cargoUnits", "draft", "length"]
                : register === "Cranes"
                  ? ["handlingRate"]
                  : register === "Berths"
                    ? ["maxDraft"]
                    : []
              ).map((key) => (
                <label className="field" key={key}>
                  {
                    {
                      cargoUnits: "Cargo demand (units)",
                      draft: "Vessel draft (m)",
                      length: "Vessel length (m)",
                      handlingRate: "Handling rate (cargo units/hour)",
                      maxDraft: "Maximum draft (m)",
                    }[key]
                  }
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={Number(
                      edit[key as keyof RecordItem] ??
                        (key === "handlingRate"
                          ? 80
                          : key === "cargoUnits"
                            ? 600
                            : key === "length"
                              ? 180
                              : key === "maxDraft"
                                ? 13
                                : 10),
                    )}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <label className="field">
                Maintenance / review date
                <input
                  required
                  type="date"
                  value={edit.maintenance}
                  onChange={(e) =>
                    setEdit({ ...edit, maintenance: e.target.value })
                  }
                />
              </label>
            </div>
            {!isNew && (register === "Cranes" || register === "Berths") && (
              <div className="notice">
                {confirmDelete ? (
                  <>
                    <p>
                      Delete {edit.name} ({edit.id})?
                    </p>
                    <p>
                      {register === "Cranes"
                        ? "This removes the crane, its matching Assets entry and its crane assignments. Handling capacity will be recalculated."
                        : "The berth must have no assigned vessels, cranes or assets. Reassign those records first."}{" "}
                      Previous reports and approval history are retained.
                    </p>
                    <button
                      type="button"
                      className="btn"
                      disabled={saving}
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeleteError("");
                      }}
                    >
                      Keep record
                    </button>{" "}
                    <button
                      type="button"
                      className="btn danger"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        setDeleteError("");
                        try {
                          await portService.deleteRecord(
                            register,
                            edit.id,
                            data.revision,
                          );
                          setEdit(null);
                          setSelected(null);
                          setToast(`${edit.name} deleted`);
                          try {
                            await refresh();
                          } catch {
                            load();
                          }
                        } catch (e) {
                          setDeleteError((e as Error).message);
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      {saving ? "Deleting…" : "Confirm delete"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn danger"
                    disabled={saving}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete {register === "Cranes" ? "crane" : "berth"}
                  </button>
                )}
                {deleteError && <p role="alert">{deleteError}</p>}
              </div>
            )}
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={saving || confirmDelete}
              >
                {saving ? "Saving…" : "Save record"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
