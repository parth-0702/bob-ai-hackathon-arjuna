import { useEffect, useState } from "react";
import {
  ArrowRight,
  Clock,
  ShieldCheck,
  Check,
  ArrowDownRight,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Badge, Forecast } from "./OperationalUI";
import {
  portService,
  type Snapshot,
  type Scenario,
  type Decision,
} from "../services/portService";
export function AlertsPanel({
  data,
  solution,
  setSolution,
  onReview,
}: {
  data: Snapshot;
  solution: string;
  setSolution: (s: string) => void;
  onReview: () => void;
}) {
  const report = data.report;
  return (
    <>
      {!report.alerts.length ? (
        <article className="panel empty-inline">
          <ShieldCheck />
          <h2>No operational alerts</h2>
          <p>
            The current backend scenario does not cross configured alert
            thresholds.
          </p>
        </article>
      ) : (
        <>
          {report.alerts.map((a) => (
            <article className="alert-card" key={a.id}>
              <div className="alert-top">
                <Badge tone="amber">{a.severity.toUpperCase()} PRIORITY</Badge>
                <span>
                  {a.id} · {a.type.replaceAll("_", " ")}
                </span>
                <span>
                  <Clock size={14} /> +{a.timeToImpactHours}h to impact
                </span>
              </div>
              <h2>{a.title}</h2>
              <p>{a.problem}</p>
              {a.dependency && (
                <div className="dependency-chain">
                  {[
                    a.dependency.asset_id,
                    a.dependency.crane_ids.join(", ") || "Infrastructure",
                    a.dependency.berth_ids.join(", "),
                    `${a.vessel_ids.length} vessels affected`,
                  ].map((s, i) => (
                    <div key={i}>
                      <span>{s}</span>
                      {i < 3 && <ArrowRight size={16} />}
                    </div>
                  ))}
                </div>
              )}
              <div className="impact-grid">
                <div>
                  <small>BERTH DEMAND / CAPACITY</small>
                  <b>{a.impact.congestion ?? "—"}%</b>
                  <span>24-hour demand index</span>
                </div>
                <div>
                  <small>AVERAGE VESSEL DELAY</small>
                  <b>
                    {a.impact.delayHours ?? "—"} <em>hours</em>
                  </b>
                  <span>{a.vessel_ids.join(" · ") || "Weather exposure"}</span>
                </div>
                <div>
                  <small>OPERATIONAL CRITICALITY</small>
                  <b>{a.impact.criticality ?? "—"} / 100</b>
                  <span>Deterministic dependency index</span>
                </div>
              </div>
              {a.risk?.class_1_probability !== undefined && (
                <p className="fine-print">
                  Provided model class-1 probability:{" "}
                  {(a.risk.class_1_probability * 100).toFixed(2)}%.{" "}
                  {a.risk.note} Input: {a.risk.input_source}.
                </p>
              )}
            </article>
          ))}
          <div className="section-heading">
            <h2>Available responses</h2>
            <span>Calculated and ranked by the backend</span>
          </div>
          <div className="solution-grid">
            {report.scenarios.map((s) => (
              <button
                key={s.id}
                className={`solution-card ${solution === s.id ? "chosen" : ""}`}
                disabled={!s.feasible}
                onClick={() => setSolution(s.id)}
              >
                <div>
                  <Badge
                    tone={s.id === report.recommended_id ? "green" : "neutral"}
                  >
                    {!s.feasible
                      ? "INFEASIBLE"
                      : s.id === report.recommended_id
                        ? "RECOMMENDED"
                        : "ALTERNATIVE"}
                  </Badge>
                  <span className="radio-check">
                    {solution === s.id && <Check size={13} />}
                  </span>
                </div>
                <h3>{s.name}</h3>
                <p>{s.detail}</p>
                <footer>
                  <span>
                    <ArrowDownRight size={15} /> {s.delay}h total delay avoided
                  </span>
                  <span>Score {s.score}</span>
                </footer>
              </button>
            ))}
          </div>
          <p className="fine-print">{report.scenarios[0]?.scoreBasis}</p>
          {report.scenarios.length > 0 && (
            <div className="action-bar">
              <span>
                <ShieldCheck size={18} />
                Recommendations do not execute operational actions.
              </span>
              <button className="btn primary" onClick={onReview}>
                Review selected response <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
export function ApprovalsPanel({
  data,
  solution,
  setSolution,
  onSaved,
  onMessage,
}: {
  data: Snapshot;
  solution: string;
  setSolution: (s: string) => void;
  onSaved: () => Promise<void>;
  onMessage: (s: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState<Decision["status"] | null>(null);
  const [busy, setBusy] = useState(false);
  const current =
    data.report.scenarios.find((s) => s.id === solution) ||
    data.report.scenarios.find((s) => s.id === data.report.recommended_id);
  const latest = data.decisions.find((d) => d.report_id === data.report.id);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!confirm) return;
    const before = document.activeElement as HTMLElement | null;
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setConfirm(null);
      if (e.key !== "Tab") return;
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Confirm operational decision"] button:not(:disabled)',
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      before?.focus();
    };
  }, [confirm, busy]);
  if (!current)
    return (
      <div className="panel empty-inline">
        <ShieldCheck />
        <h2>No recommendations awaiting review</h2>
      </div>
    );
  async function commit() {
    if (!confirm || !current) return;
    setBusy(true);
    try {
      await portService.decide(
        data.report.id,
        current.id,
        confirm,
        comment,
        requestId,
      );
      setConfirm(null);
      setRequestId(crypto.randomUUID());
      await onSaved();
      onMessage("Decision and operational plan recorded by the backend.");
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function review(status: Decision["status"]) {
    if (status !== "Approved" && !comment.trim()) {
      onMessage("Enter a comment for a modified or rejected response.");
      return;
    }
    setConfirm(status);
  }
  return (
    <>
      <div className="approval-grid">
        <article className="panel">
          <div className="section-heading">
            <Badge tone="amber">
              HUMAN REVIEW / {data.report.id.slice(-8)}
            </Badge>
            <ShieldCheck size={22} />
          </div>
          <h2>{current.name}</h2>
          <p>{current.detail}</p>
          <label className="field">
            Response to review
            <select
              disabled={!!latest}
              value={current.id}
              onChange={(e) => setSolution(e.target.value)}
            >
              {data.report.scenarios.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.feasible}>
                  {s.name}
                  {!s.feasible ? " — infeasible" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="impact-grid two">
            <div>
              <small>TOTAL VESSEL DELAY AVOIDED</small>
              <b>
                {current.delay} <em>hours</em>
              </b>
            </div>
            <div>
              <small>PEAK CONGESTION REDUCTION</small>
              <b>
                {current.congestion} <em>points</em>
              </b>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Resources</dt>
              <dd>{current.resources}</dd>
            </div>
            <div>
              <dt>Affected berths</dt>
              <dd>{current.affectedBerths.join(" · ")}</dd>
            </div>
            <div>
              <dt>Affected vessels</dt>
              <dd>{current.affectedVessels.join(" · ")}</dd>
            </div>
            <div>
              <dt>Assumptions</dt>
              <dd>{current.assumption}</dd>
            </div>
            <div>
              <dt>Ranking</dt>
              <dd>{current.scoreBasis}</dd>
            </div>
          </dl>
          <label className="field">
            Operator comment<span>Required when modifying or rejecting</span>
            <textarea
              disabled={!!latest}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Record your reasoning or conditions. To modify the plan, select an evaluated alternative above."
            />
          </label>
          <div className="approval-actions">
            <button
              className="btn primary"
              disabled={!!latest}
              onClick={() => review("Approved")}
            >
              Approve
            </button>
            <button
              className="btn"
              disabled={!!latest}
              onClick={() => review("Modified")}
            >
              Modify
            </button>
            <button
              className="btn danger"
              disabled={!!latest}
              onClick={() => review("Rejected")}
            >
              Reject
            </button>
          </div>
          {latest && (
            <p className="notice">
              This analysis has a recorded decision. Changing port state creates
              a new analysis for review.
            </p>
          )}
        </article>
        <div>
          <article className="panel">
            <div className="eyebrow">EXPECTED OPERATIONAL IMPACT</div>
            <h3>Compare the same operating window.</h3>
            <Forecast
              series={data.report.congestion.series}
              response={current.series}
            />
            <p className="fine-print">
              Calculated by the queue simulator. Repair timing and equipment
              compatibility assumptions require operator checks.
            </p>
          </article>
          <article className="panel">
            <div className="section-heading">
              <h3>Operational explanation</h3>
              <button
                className="btn small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await portService.explain(data.report.id);
                    await onSaved();
                  } catch (e) {
                    onMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Requesting…" : "Explain with AI"}
              </button>
            </div>
            <Badge
              tone={
                data.report.explanation.status === "available"
                  ? "green"
                  : "neutral"
              }
            >
              {data.report.explanation.status === "available"
                ? data.report.explanation.provider.toUpperCase()
                : "DETERMINISTIC BACKEND"}
            </Badge>
            <p>{data.report.explanation.summary}</p>
            {data.report.explanation.error && (
              <p className="fine-print">{data.report.explanation.error}</p>
            )}
          </article>
          <article className="panel decision-record">
            <h3>Decision record</h3>
            {latest ? (
              <>
                <Badge tone={latest.status === "Rejected" ? "red" : "green"}>
                  {latest.status}
                </Badge>
                <p>{latest.scenario?.name}</p>
                <p>{latest.comment || "Approved as proposed."}</p>
                <small>
                  {latest.actor} · {new Date(latest.at).toLocaleString()}
                </small>
                <hr />
                <h4>
                  {latest.plan
                    ? "Accepted operational plan"
                    : "Operational plan unchanged"}
                </h4>
                {latest.plan ? (
                  <>
                    <ol>
                      {latest.plan.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ol>
                    <p>{latest.plan.operatorConditions}</p>
                    <small>No real equipment commands were issued.</small>
                  </>
                ) : (
                  <p>No operational action accepted.</p>
                )}
              </>
            ) : (
              <div className="empty-inline">Awaiting operator review.</div>
            )}
          </article>
        </div>
      </div>
      <article className="panel">
        <h3>Approval history & audit</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Decision</th>
                <th>Scenario</th>
                <th>Operator comment</th>
              </tr>
            </thead>
            <tbody>
              {[...data.decisions].reverse().map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.at).toLocaleString()}</td>
                  <td>{d.status}</td>
                  <td>{d.scenario?.name || d.solution}</td>
                  <td>{d.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.decisions.length && (
            <div className="empty-inline">No decisions recorded.</div>
          )}
        </div>
        <p className="fine-print">
          {data.audit.length} recent audit events are persisted in SQLite,
          including inputs, recommendations and human decisions.
        </p>
      </article>
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm operational decision"
          >
            <ShieldCheck size={30} />
            <h2>Confirm {confirm.toLowerCase()} decision</h2>
            <p>{current.name}</p>
            <p>{comment || "Accept the evaluated response as proposed."}</p>
            <div className="notice">
              This accepts a plan inside the demo. Operational equipment is not
              controlled. Any free-text conditions require human follow-through.
            </div>
            <footer>
              <button
                autoFocus
                className="btn"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Back to review
              </button>
              <button className="btn primary" disabled={busy} onClick={commit}>
                {busy ? "Recording…" : "Confirm decision"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
export function BackendSettings({
  data,
  onSaved,
  onMessage,
}: {
  data: Snapshot;
  onSaved: () => Promise<void>;
  onMessage: (s: string) => void;
}) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("portsentinel-operator-token") || "",
  );
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  async function simulate(event: "advance" | "degrade" | "repair" | "reset") {
    setBusy(true);
    try {
      await portService.simulate(event);
      await onSaved();
      onMessage("Backend simulation updated.");
      setReset(false);
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel settings-panel">
      <h2>Connected operations workspace</h2>
      <p>
        Port records and scenario calculations come from the Python backend.
        Operational data is simulated; external weather is labeled separately.
      </p>
      <dl className="detail-list">
        <div>
          <dt>Simulation clock</dt>
          <dd>{new Date(data.simulationTime).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>
            {data.services.model.status} ·{" "}
            {data.services.model.compatibilityRecovery
              ? "original embedded-model recovery"
              : "direct loading"}
          </dd>
        </div>
        <div>
          <dt>Class-1 semantics</dt>
          <dd>
            {data.services.model.positiveClassConfirmed
              ? "Confirmed as failure"
              : "Awaiting training-interface confirmation"}
          </dd>
        </div>
        <div>
          <dt>Weather</dt>
          <dd>
            {data.weather.status} · {data.weather.source}
          </dd>
        </div>
        <div>
          <dt>AI provider</dt>
          <dd>
            {data.services.llm.provider} · {data.services.llm.model} ·{" "}
            {data.services.llm.status}
            {data.services.llm.missing.length
              ? ` · Missing: ${data.services.llm.missing.join(", ")}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Persistence</dt>
          <dd>SQLite · state revision {data.revision}</dd>
        </div>
      </dl>
      <h3>Reproducible demo controls</h3>
      <p className="fine-print">
        Each action advances the simulated clock 6 hours, persists changed
        state, and recalculates a new report.
      </p>
      <div className="approval-actions">
        <button
          disabled={busy}
          className="btn"
          onClick={() => simulate("advance")}
        >
          Advance 6 hours
        </button>
        <button
          disabled={busy}
          className="btn"
          onClick={() => simulate("degrade")}
        >
          Degrade east-quay assets
        </button>
        <button
          disabled={busy}
          className="btn"
          onClick={() => simulate("repair")}
        >
          Restore demo assets
        </button>
      </div>
      <button className="btn danger" onClick={() => setReset(true)}>
        Reset demo scenario
      </button>
      {reset && (
        <div className="notice">
          Restore seeded port records? Existing audit and decision history will
          be preserved.
          <div className="approval-actions">
            <button
              disabled={busy}
              className="btn danger"
              onClick={() => simulate("reset")}
            >
              Confirm demo reset
            </button>
            <button className="btn" onClick={() => setReset(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <label className="field">
        Optional operator token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          placeholder="Only needed if configured on the backend"
        />
      </label>
      <button
        className="btn"
        onClick={() => {
          if (token)
            sessionStorage.setItem("portsentinel-operator-token", token);
          else sessionStorage.removeItem("portsentinel-operator-token");
          onMessage("Operator token saved for this browser session.");
        }}
      >
        Save session token
      </button>
      <p className="fine-print">
        AI provider keys stay in the backend .env file. Never enter them here.
      </p>
    </article>
  );
}
