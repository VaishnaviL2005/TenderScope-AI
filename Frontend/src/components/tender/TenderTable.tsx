import { Fragment, useState } from "react";
import { useAsync } from "../../hooks/useAsync";
import { getTender } from "../../services/tenderService";
import type { TenderSummary } from "../../types/api";
import { DASH } from "../../utils/data";
import { formatDate } from "../../utils/format";
import { btn, ErrorAlert, Spinner } from "../common/ui";
import ValueView from "../common/ValueView";
import StatusBadge from "./StatusBadge";
import TenderActions from "./TenderActions";

function TenderDetails({ tenderId }: { tenderId: string }) {
  const d = useAsync(() => getTender(tenderId).then((r) => r.data), [tenderId]);
  if (d.loading) return <Spinner label="Loading tender details..." />;
  if (d.error) return <ErrorAlert error={d.error} title="Could not load tender details" onRetry={d.reload} />;
  return <ValueView value={d.data} />;
}

export default function TenderTable({ tenders, showDetails = false }: { tenders: TenderSummary[]; showDetails?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Tender ID</th>
            <th className="px-4 py-3">Filename</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {tenders.map((t, i) => (
            <Fragment key={t.tender_id || `row-${i}`}>
              <tr className="hover:bg-slate-50">
                <td className="max-w-[240px] break-all px-4 py-3 font-mono text-xs text-slate-700">{t.tender_id || DASH}</td>
                <td className="max-w-[280px] break-words px-4 py-3 font-medium text-navy-900">{t.filename ?? DASH}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(t.created_at)}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {showDetails && t.tender_id && (
                      <button className={btn.ghostSm} onClick={() => setOpenId(openId === t.tender_id ? null : t.tender_id)}>
                        {openId === t.tender_id ? "Hide" : "Details"}
                      </button>
                    )}
                    <TenderActions tender={t} />
                  </div>
                </td>
              </tr>
              {showDetails && openId === t.tender_id && (
                <tr>
                  <td colSpan={5} className="bg-slate-50 px-4 py-4"><TenderDetails tenderId={t.tender_id} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
