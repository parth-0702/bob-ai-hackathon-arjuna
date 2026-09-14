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
import WeatherPanel from "./components/WeatherPanel";
import CongestionPanel from "./components/CongestionPanel";
import { Badge, Forecast } from "./components/OperationalUI";
const PortScene = lazy(() => import("./components/PortScene"));
import {
  portService,
  resetDemo,
  solutions,
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
  const [resetPrompt, setResetPrompt] = useState(false);
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
  const [solution, setSolution] = useState("S1");
  const [comment, setComment] = useState("");
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
      setData(next);
      setToast(message);
      return true;
    } catch {
      setToast(
        "Could not save. Browser storage may be full or disabled. Please retry.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  const current = solutions.find((s) => s.id === solution)!;
  const latest = data?.decisions.at(-1);
  const handled = !!latest;
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
              <Clock size={13} /> DEMO · 14 SEP 2026 · 09:41 IST
            </span>
            <Badge tone="neutral">SIMULATED DATA</Badge>
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
            <button
              className="btn"
              onClick={() => {
                resetDemo();
                history.replaceState(null, "", location.pathname);
                load();
              }}
            >
              Reset demo data
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
                      <b>31°</b>
                      <span>Partly cloudy</span>
                    </div>
                    <i />
                    <div>
                      <Wind size={15} />
                      <span>SW 14 kn</span>
                    </div>
                    <small>DEMO WEATHER</small>
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
                          <b>East quay requires attention</b>
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
                                  {Math.min(
                                    98,
                                    b.workload +
                                      (horizon ? (i === 2 ? 8 : 4) : 0),
                                  )}
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
                            maintenance: "2026-09-21",
                            origin: "",
                            destination: "Kandla",
                            eta: "2026-09-14T14:00",
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
                  {page === "Alerts" && emptyPort ? (
                    <div className="panel empty-inline">
                      <Bell />
                      <h2>No operational alerts</h2>
                      <p>Add port resources to begin a scenario.</p>
                    </div>
                  ) : (
                    page === "Alerts" && (
                      <>
                        <div className="summary-row">
                          <div>
                            <span>Operational watch</span>
                            <b>
                              01 <small>developing risk</small>
                            </b>
                          </div>
                          <div>
                            <span>Time to impact</span>
                            <b>
                              ~6 <small>hours</small>
                            </b>
                          </div>
                          <div>
                            <span>Affected operations</span>
                            <b>
                              02 <small>vessels</small>
                            </b>
                          </div>
                          <div>
                            <span>Review status</span>
                            <Badge tone={handled ? "green" : "amber"}>
                              {handled
                                ? latest.status
                                : "Operator review required"}
                            </Badge>
                          </div>
                        </div>
                        <article className="alert-card">
                          <div className="alert-top">
                            <Badge tone="amber">HIGH PRIORITY</Badge>
                            <span>PSN-042 · Infrastructure → congestion</span>
                            <span>
                              <Clock size={14} /> +6h to impact
                            </span>
                          </div>
                          <h2>
                            Power risk at the east quay could become a vessel
                            queue.
                          </h2>
                          <p>
                            Power unit P03 is showing elevated simulated risk.
                            Crane C07 depends on that supply, reducing available
                            handling capacity at berth B03.
                          </p>
                          <div className="dependency-chain">
                            {[
                              "P03 · Power supply",
                              "C07 · Crane capacity",
                              "B03 · Handling delay",
                              "2 vessels affected",
                            ].map((s, i) => (
                              <div key={s}>
                                <span>{s}</span>
                                {i < 3 && <ArrowRight size={16} />}
                              </div>
                            ))}
                          </div>
                          <div className="impact-grid">
                            <div>
                              <small>PREDICTED CONGESTION</small>
                              <b>
                                82% <ArrowUpRight size={20} />
                              </b>
                              <span>+34 percentage points</span>
                            </div>
                            <div>
                              <small>ADDITIONAL DELAY</small>
                              <b>
                                3.2 <em>hours</em>
                              </b>
                              <span>Kutch Voyager · Ocean Meridian</span>
                            </div>
                            <div>
                              <small>CONFIDENCE & BASIS</small>
                              <b>Scenario estimate</b>
                              <span>Demo assumptions · no model connected</span>
                            </div>
                          </div>
                        </article>
                        <div className="section-heading">
                          <h2>Available responses</h2>
                          <span>Ranked from a predefined solution set</span>
                        </div>
                        <div className="solution-grid">
                          {solutions.map((s, i) => (
                            <button
                              key={s.id}
                              className={`solution-card ${solution === s.id ? "chosen" : ""}`}
                              onClick={() => setSolution(s.id)}
                            >
                              <div>
                                <Badge tone={i === 0 ? "green" : "neutral"}>
                                  {i === 0
                                    ? "RECOMMENDED"
                                    : `ALTERNATIVE 0${i}`}
                                </Badge>
                                <span className="radio-check">
                                  {solution === s.id && <Check size={13} />}
                                </span>
                              </div>
                              <h3>{s.name}</h3>
                              <p>{s.detail}</p>
                              <footer>
                                <span>
                                  <ArrowDownRight size={15} /> {s.delay}h less
                                  delay
                                </span>
                                <span>{s.risk} risk</span>
                              </footer>
                            </button>
                          ))}
                        </div>
                        <div className="action-bar">
                          <span>
                            <ShieldCheck size={18} /> No operational action
                            occurs without human approval.
                          </span>
                          <button
                            className="btn primary"
                            onClick={() => go("Approvals")}
                          >
                            Review selected response <ArrowRight size={16} />
                          </button>
                        </div>
                      </>
                    )
                  )}
                  {page === "Approvals" && emptyPort ? (
                    <div className="panel empty-inline">
                      <ShieldCheck />
                      <h2>No recommendations awaiting review</h2>
                    </div>
                  ) : (
                    page === "Approvals" && (
                      <div className="approval-grid">
                        <article className="panel">
                          <div className="section-heading">
                            <Badge tone="amber">PSN-042 / HUMAN REVIEW</Badge>
                            <ShieldCheck size={22} />
                          </div>
                          <h2>{current.name}</h2>
                          <p>{current.detail}</p>
                          <label className="field">
                            Response to review
                            <select
                              value={solution}
                              onChange={(e) => setSolution(e.target.value)}
                            >
                              {solutions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="impact-grid two">
                            <div>
                              <small>ESTIMATED DELAY REDUCTION</small>
                              <b>
                                {current.delay} <em>hours</em>
                              </b>
                            </div>
                            <div>
                              <small>CONGESTION REDUCTION</small>
                              <b>
                                {current.congestion} <em>points</em>
                              </b>
                            </div>
                          </div>
                          <dl className="detail-list">
                            <div>
                              <dt>Required resources</dt>
                              <dd>{current.resources}</dd>
                            </div>
                            <div>
                              <dt>Affected berths</dt>
                              <dd>B03 · B04</dd>
                            </div>
                            <div>
                              <dt>Affected vessels</dt>
                              <dd>Kutch Voyager · Ocean Meridian</dd>
                            </div>
                            <div>
                              <dt>Risk reduction</dt>
                              <dd>
                                Expected handling exposure reduced; unvalidated
                                demo estimate
                              </dd>
                            </div>
                            <div>
                              <dt>Assumptions</dt>
                              <dd>{current.assumption}</dd>
                            </div>
                          </dl>
                          <label className="field">
                            Operator comment{" "}
                            <span>Required when modifying or rejecting</span>
                            <textarea
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="Record your reasoning, conditions or revised instructions…"
                              rows={3}
                            />
                          </label>
                          <div className="approval-actions">
                            <button
                              className="btn primary"
                              disabled={handled}
                              onClick={() => setDecision("Approved")}
                            >
                              <Check size={16} />
                              Approve
                            </button>
                            <button
                              className="btn"
                              disabled={handled}
                              onClick={() => {
                                if (!comment.trim()) {
                                  setToast(
                                    "Add a comment describing the modification first.",
                                  );
                                  return;
                                }
                                setDecision("Modified");
                              }}
                            >
                              Modify
                            </button>
                            <button
                              className="btn danger"
                              disabled={handled}
                              onClick={() => {
                                if (!comment.trim()) {
                                  setToast(
                                    "Add a reason for rejecting this response first.",
                                  );
                                  return;
                                }
                                setDecision("Rejected");
                              }}
                            >
                              Reject
                            </button>
                          </div>
                          {handled && (
                            <p className="notice">
                              A decision is already recorded for this demo
                              alert. Reset the demo in Settings to review it
                              again.
                            </p>
                          )}
                        </article>
                        <div>
                          <article className="panel">
                            <div className="eyebrow">
                              EXPECTED OPERATIONAL IMPACT
                            </div>
                            <h3>Relieve pressure before it spreads.</h3>
                            <Forecast solutionId={solution} />
                            <p className="fine-print">
                              Illustrative comparison for the selected response.
                              Actual impacts require backend scenario
                              evaluation.
                            </p>
                          </article>
                          <article className="panel decision-record">
                            <h3>Decision record</h3>
                            {latest ? (
                              <>
                                <Badge
                                  tone={
                                    latest.status === "Rejected"
                                      ? "red"
                                      : "green"
                                  }
                                >
                                  {latest.status}
                                </Badge>
                                <p>
                                  {
                                    solutions.find(
                                      (s) => s.id === latest.solution,
                                    )?.name
                                  }
                                </p>
                                <p>
                                  {latest.comment || "Approved as proposed."}
                                </p>
                                <small>
                                  {new Date(latest.at).toLocaleString()}
                                </small>
                                <hr />
                                <h4>
                                  {latest.status === "Rejected"
                                    ? "Operational plan unchanged"
                                    : "Approved simulated plan"}
                                </h4>
                                <p>
                                  {latest.status === "Rejected"
                                    ? "No action scheduled."
                                    : latest.status === "Modified"
                                      ? latest.comment
                                      : solutions.find(
                                          (s) => s.id === latest.solution,
                                        )?.detail}
                                </p>
                                <small>
                                  Recorded locally. No equipment command was
                                  issued.
                                </small>
                              </>
                            ) : (
                              <div className="empty-inline">
                                <ShieldCheck size={28} />
                                <p>Awaiting your review</p>
                                <small>
                                  Your decision and comments will appear here.
                                </small>
                              </div>
                            )}
                          </article>
                        </div>
                      </div>
                    )
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
                    <WeatherPanel setSelected={setSelected} />
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
                        Demo register · changes are saved in this browser.
                        Capacity units depend on asset type; vessel capacity
                        reflects its cargo units.{" "}
                        {register === "Berths" || register === "Cranes"
                          ? "Live operational status is available in Live Port View."
                          : ""}
                      </p>
                    </>
                  )}
                  {page === "Settings" && (
                    <article className="panel settings-panel">
                      <h2>Simulation workspace</h2>
                      <p>
                        This frontend uses a local demo service. No weather
                        feed, prediction model, private port system or
                        operational control is connected.
                      </p>
                      <dl className="detail-list">
                        <div>
                          <dt>Reference environment</dt>
                          <dd>Deendayal / Kandla Port, Gujarat</dd>
                        </div>
                        <div>
                          <dt>Scene geography</dt>
                          <dd>
                            Illustrative industrial quay, not surveyed berth
                            geometry
                          </dd>
                        </div>
                        <div>
                          <dt>Operations & forecasts</dt>
                          <dd>Simulated fixtures; no validated predictions</dd>
                        </div>
                        <div>
                          <dt>Storage</dt>
                          <dd>This browser, on this device</dd>
                        </div>
                        <div>
                          <dt>Operational authority</dt>
                          <dd>Human review only; no equipment commands</dd>
                        </div>
                      </dl>
                      <button
                        className="btn"
                        onClick={() => {
                          setPaused(!paused);
                          setToast(
                            paused
                              ? "Vessel movement resumed"
                              : "Vessel movement paused",
                          );
                        }}
                      >
                        {paused ? "Resume" : "Pause"} scene movement
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => setResetPrompt(true)}
                      >
                        Reset demo data
                      </button>
                      {resetPrompt && (
                        <div className="notice">
                          <p>
                            Restore the initial demo scenario? Locally edited
                            records and review decisions will be removed.
                          </p>
                          <button
                            className="btn danger"
                            onClick={() => {
                              resetDemo();
                              history.replaceState(
                                null,
                                "",
                                `${location.pathname}#Settings`,
                              );
                              setResetPrompt(false);
                              load();
                              setToast("Demo workspace reset");
                            }}
                          >
                            Confirm demo reset
                          </button>{" "}
                          <button
                            className="btn"
                            onClick={() => setResetPrompt(false)}
                          >
                            Keep current data
                          </button>
                        </div>
                      )}
                    </article>
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
                  {item?.health ?? 94}% / {item?.workload ?? 61}%
                </dd>
              </div>
              <div>
                <dt>Congestion / queue</dt>
                <dd>
                  {selected === "B03" ? "82% / 5 vessels" : "24% / 1 vessel"}
                </dd>
              </div>
              <div>
                <dt>Expected delay</dt>
                <dd>
                  {selected === "B03" || selected === "C07"
                    ? "+3.2 hours"
                    : "+10 minutes"}
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
                  {selected === "B03" ||
                  selected === "C07" ||
                  selected === "P03"
                    ? "P03 → C07 → B03 → Kutch Voyager"
                    : "Assigned quay resources"}
                </dd>
              </div>
              <div>
                <dt>Available cranes</dt>
                <dd>
                  {selected === "B03"
                    ? "C07 restricted · C09 alternative"
                    : "Assigned crane available"}
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
            <Forecast horizon={horizon || 24} />
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
                      value={edit.eta || "2026-09-14T14:00"}
                      onChange={(e) =>
                        setEdit({ ...edit, eta: e.target.value })
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
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={saving}>
                {saving ? "Saving…" : "Save record"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {decision && data && (
        <div className="modal-backdrop">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
          >
            <ShieldCheck size={30} />
            <h2 id="decision-title">
              Confirm {decision.toLowerCase()} decision
            </h2>
            <p>{current.name}</p>
            <p>{comment || "Approve this response as proposed."}</p>
            <div className="notice">
              This records a simulated operational plan. It does not control
              real port equipment.
            </div>
            <footer>
              <button
                autoFocus
                className="btn"
                onClick={() => setDecision(null)}
              >
                Back to review
              </button>
              <button
                className="btn primary"
                disabled={saving}
                onClick={async () => {
                  if (
                    await persist(
                      {
                        ...data,
                        decisions: [
                          ...data.decisions,
                          {
                            id: "PSN-042",
                            solution,
                            comment,
                            status: decision,
                            at: new Date().toISOString(),
                          },
                        ],
                      },
                      "Decision recorded in the simulated operational plan",
                    )
                  )
                    setDecision(null);
                }}
              >
                {saving ? "Recording…" : "Confirm decision"}
              </button>
            </footer>
          </section>
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
