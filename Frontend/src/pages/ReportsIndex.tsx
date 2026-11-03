import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { btn, Card, EmptyState, ErrorAlert, PageHeader, Spinner } from "../components/common/ui";
import TenderTable from "../components/tender/TenderTable";
import { useAsync } from "../hooks/useAsync";
import { listAllTenders } from "../services/tenderService";
import { statusKind } from "../utils/status";

export default function ReportsIndex() {
  const navigate = useNavigate();
  const all = useAsync(() => listAllTenders(), []);
  const [manualId, setManualId] = useState("");
  const completed = (all.data ?? []).filter((t) => statusKind(t.status) === "completed");

  return (
    <div className="space-y-6">
      <PageHeader title="Analysis Reports" subtitle="Open the consolidated report for any analyzed tender." actions={<button className={btn.secondary} onClick={all.reload}>Refresh</button>} />

      <Card title="Open by tender ID">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = manualId.trim();
            if (id) navigate(`/reports/${encodeURIComponent(id)}`);
          }}
        >
          <input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Paste a tender_id"
            className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
          />
          <button className={btn.primary} disabled={!manualId.trim()}>Open report</button>
        </form>
      </Card>

      <Card title="Completed analyses">
        {all.loading && !all.data ? (
          <Spinner label="Loading tenders..." />
        ) : all.error ? (
          <ErrorAlert error={all.error} title="Could not load tenders" onRetry={all.reload} />
        ) : completed.length === 0 ? (
          <EmptyState title="No completed analyses yet" message="Analyze an uploaded tender to generate its report." action={<Link to="/upload" className={btn.primary}>Upload Tender</Link>} />
        ) : (
          <TenderTable tenders={completed} />
        )}
      </Card>
    </div>
  );
}
