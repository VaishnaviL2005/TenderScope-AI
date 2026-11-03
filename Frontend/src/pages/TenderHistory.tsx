import { Link, useSearchParams } from "react-router-dom";
import { btn, Card, EmptyState, ErrorAlert, PageHeader, Spinner } from "../components/common/ui";
import TenderTable from "../components/tender/TenderTable";
import { useAsync } from "../hooks/useAsync";
import { listTenders } from "../services/tenderService";

const SIZES = [10, 20, 50];

export default function TenderHistory() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sizeParam = Number(params.get("page_size"));
  const pageSize = SIZES.includes(sizeParam) ? sizeParam : 10;
  const res = useAsync(() => listTenders(page, pageSize), [page, pageSize]);

  const go = (p: number, size = pageSize) => setParams({ page: String(p), page_size: String(size) });
  const data = res.data;
  const totalPages = data ? data.total_pages ?? (data.total !== null ? Math.max(1, Math.ceil(data.total / pageSize)) : null) : null;
  const hasNext = data ? (totalPages !== null ? page < totalPages : data.items.length === pageSize) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tender History"
        subtitle="All uploaded tenders and their analysis status."
        actions={
          <>
            <button className={btn.secondary} onClick={res.reload} disabled={res.loading}>Refresh</button>
            <Link to="/upload" className={btn.primary}>Upload Tender</Link>
          </>
        }
      />
      <Card>
        {res.loading && !data ? (
          <Spinner label="Loading tenders..." />
        ) : res.error ? (
          <ErrorAlert error={res.error} title="Could not load tender history" onRetry={res.reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={page > 1 ? "No tenders on this page" : "No tenders yet"}
            message={page > 1 ? "Go back to the previous page." : "Uploaded tenders will appear here."}
            action={page > 1 ? <button className={btn.secondary} onClick={() => go(1)}>First page</button> : <Link to="/upload" className={btn.primary}>Upload Tender</Link>}
          />
        ) : (
          <>
            <TenderTable tenders={data.items} showDetails />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                Rows per page
                <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={pageSize} onChange={(e) => go(1, Number(e.target.value))}>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {data.total !== null && <span className="ml-2">Total: {data.total}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button className={btn.secondarySm} disabled={page <= 1 || res.loading} onClick={() => go(page - 1)}>Previous</button>
                <span className="text-slate-600">Page {page}{totalPages !== null ? ` of ${totalPages}` : ""}</span>
                <button className={btn.secondarySm} disabled={!hasNext || res.loading} onClick={() => go(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
