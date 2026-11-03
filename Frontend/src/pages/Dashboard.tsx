import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { btn, Card, Collapsible, EmptyState, ErrorAlert, PageHeader, Spinner } from "../components/common/ui";
import ValueView from "../components/common/ValueView";
import TenderTable from "../components/tender/TenderTable";
import { useAsync } from "../hooks/useAsync";
import { useHealth } from "../hooks/useHealth";
import { listAllTenders } from "../services/tenderService";
import { isObj, pick, pickKey, shortText, type Obj } from "../utils/data";
import { readiness, statusKind } from "../utils/status";

type TileState = boolean | "partial" | null | "unreported";

function HealthTile({ label, state, detail, loading }: { label: string; state: TileState; detail?: ReactNode; loading: boolean }) {
  const look = loading
    ? { dot: "bg-slate-300 animate-pulse", text: "Checking..." }
    : state === "unreported"
    ? { dot: "bg-slate-300", text: "Not reported" }
    : state === true
    ? { dot: "bg-teal-500", text: "Ready" }
    : state === false
    ? { dot: "bg-red-500", text: "Not ready" }
    : state === "partial"
    ? { dot: "bg-amber-500", text: "Degraded" }
    : { dot: "bg-amber-400", text: "Unknown" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${look.dot}`} />
        <span className="font-semibold text-navy-900">{look.text}</span>
      </div>
      {detail && !loading && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const health = useHealth(60000);
  const tenders = useAsync(() => listAllTenders(), []);

  const stats = useMemo(() => {
    if (!tenders.data) return null;
    const c = { total: tenders.data.length, completed: 0, pending: 0, failed: 0 };
    for (const t of tenders.data) {
      const k = statusKind(t.status);
      if (k === "completed") c.completed++;
      else if (k === "failed") c.failed++;
      else if (k === "uploaded" || k === "processing") c.pending++;
    }
    return c;
  }, [tenders.data]);

  const recent = useMemo(
    () => (tenders.data ? [...tenders.data].sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0)).slice(0, 6) : []),
    [tenders.data]
  );

  const hd: Obj = useMemo(() => {
    const d = health.data;
    if (!isObj(d)) return {};
    return {
      ...d,
      ...(isObj(d.components) ? d.components : {}),
      ...(isObj(d.checks) ? d.checks : {}),
      ...(isObj(d.services) ? d.services : {}),
      ...(isObj(d.dependencies) ? d.dependencies : {}),
    };
  }, [health.data]);

  const comp = (keys: string[]): { state: TileState; detail: string } => {
    const k = pickKey(hd, keys);
    if (!k) return { state: "unreported", detail: "Not included in /health response" };
    return { state: readiness(hd[k]), detail: `${k}: ${shortText(hd[k], 60)}` };
  };
  const db = comp(["database", "db", "database_status", "db_status", "postgres", "neon"]);
  const storage = comp(["object_storage", "object_storage_status", "storage", "storage_status", "s3", "minio", "blob_storage", "r2"]);
  const kb = comp(["knowledge_base", "knowledge_base_status", "kb", "kb_status", "vector_store", "faiss", "faiss_index", "vector_index"]);
  const backendState: TileState = health.reachable === false ? false : health.degraded ? "partial" : health.reachable ? true : null;
  const backendDetail = health.reachable === false ? health.error : String(pick(hd, ["status"]) ?? health.message ?? "Reachable");
  const n = (v: number | undefined) => (tenders.loading && !tenders.data ? "..." : v ?? "-");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Intelligent Tender Analysis. Smarter Product Decisions."
        actions={<Link to="/upload" className={btn.primary}>Upload Tender</Link>}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">System health</h2>
          <button onClick={health.refresh} className={btn.ghostSm}>Recheck</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile label="Backend API" loading={health.loading} state={backendState} detail={backendDetail} />
          <HealthTile label="Database" loading={health.loading} state={health.reachable === false ? null : db.state} detail={db.detail} />
          <HealthTile label="Object storage" loading={health.loading} state={health.reachable === false ? null : storage.state} detail={storage.detail} />
          <HealthTile label="Knowledge base" loading={health.loading} state={health.reachable === false ? null : kb.state} detail={kb.detail} />
        </div>
        {health.data && (
          <div className="mt-3">
            <Collapsible title="Raw /health response"><ValueView value={health.data} /></Collapsible>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tender statistics</h2>
        {tenders.error ? (
          <ErrorAlert error={tenders.error} title="Could not load tenders" onRetry={tenders.reload} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total tenders" value={n(stats?.total)} tone="text-navy-900" />
            <StatCard label="Completed analyses" value={n(stats?.completed)} tone="text-teal-600" />
            <StatCard label="Pending analyses" value={n(stats?.pending)} tone="text-amber-600" />
            <StatCard label="Failed analyses" value={n(stats?.failed)} tone="text-red-600" />
          </div>
        )}
      </section>

      <Card title="Recent tenders" actions={<Link to="/history" className={btn.ghostSm}>View all</Link>}>
        {tenders.loading && !tenders.data ? (
          <Spinner label="Loading tenders..." />
        ) : tenders.error ? (
          <p className="text-sm text-slate-500">Unavailable.</p>
        ) : recent.length === 0 ? (
          <EmptyState title="No tenders yet" message="Upload your first tender document to start an analysis." action={<Link to="/upload" className={btn.primary}>Upload Tender</Link>} />
        ) : (
          <TenderTable tenders={recent} />
        )}
      </Card>
    </div>
  );
}
