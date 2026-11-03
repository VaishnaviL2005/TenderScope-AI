import { collect, isObj, omit, pick } from "../../utils/data";
import { verdict } from "../../utils/status";
import { Badge, EmptyState } from "../common/ui";
import ValueView from "../common/ValueView";

const STATUS_KEYS = ["review_status", "status", "overall_status", "result", "verdict"];
const MISSING_KEYS = ["missing_information", "missing_info", "missing_fields", "missing"];
const UNRESOLVED_KEYS = ["unresolved_requirements", "unresolved", "open_issues"];
const WARNING_KEYS = ["warnings", "quality_warnings", "issues"];

function ListBlock({ title, items, tone }: { title: string; items: unknown[]; tone: "amber" | "red" }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-navy-900">{title} <span className="font-normal text-slate-500">({items.length})</span></h4>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((x, i) => (
            <li key={i} className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{isObj(x) || Array.isArray(x) ? <ValueView value={x} /> : String(x)}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">None reported.</p>
      )}
    </div>
  );
}

export default function QualityReviewSection({ quality }: { quality: unknown }) {
  if (!isObj(quality)) return <EmptyState title="No quality review" message="The report does not contain quality_review." />;
  const status = pick(quality, STATUS_KEYS);
  const v = verdict(status);
  const extra = omit(quality, [...STATUS_KEYS, ...MISSING_KEYS, ...UNRESOLVED_KEYS, ...WARNING_KEYS]);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Review status:</span>
        {status === undefined ? <Badge tone="slate">Not reported</Badge> : <Badge tone={v === true ? "teal" : v === false ? "red" : "amber"}>{String(status)}</Badge>}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <ListBlock title="Missing information" items={collect(quality, MISSING_KEYS)} tone="amber" />
        <ListBlock title="Unresolved requirements" items={collect(quality, UNRESOLVED_KEYS)} tone="red" />
        <ListBlock title="Warnings" items={collect(quality, WARNING_KEYS)} tone="amber" />
      </div>
      {Object.keys(extra).length > 0 && <div className="rounded-lg border border-slate-200 p-4"><ValueView value={extra} /></div>}
    </div>
  );
}
