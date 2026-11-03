import type { TenderSummary } from "../../types/api";
import { isObj, omit, pick, pickFrom } from "../../utils/data";
import { formatDate } from "../../utils/format";
import { Badge, Collapsible } from "../common/ui";
import ValueView from "../common/ValueView";

export const OVERVIEW_CONTAINERS = ["tender_overview", "overview", "tender_info", "tender_details", "tender_summary", "tender_metadata"];
export const OVERVIEW_FIELDS = [
  { label: "Tender title", keys: ["tender_title", "title", "tender_name", "project_name"] },
  { label: "Tender reference", keys: ["tender_reference", "reference", "reference_number", "reference_no", "tender_number", "tender_no", "rfp_number", "tender_ref", "rfp_reference"] },
  { label: "Buyer / Organization", keys: ["buyer", "buyer_name", "buyer_organization", "organization", "organisation", "issuing_authority", "client", "purchaser"] },
  { label: "Submission deadline", keys: ["submission_deadline", "deadline", "due_date", "bid_due_date", "bid_submission_date", "closing_date"] },
  { label: "Scope of supply", keys: ["scope_of_supply", "scope", "scope_of_work", "supply_scope"] },
];
export const OVERVIEW_KEYS = OVERVIEW_FIELDS.flatMap((f) => f.keys);

export default function TenderOverview({ report, requirements, tender }: { report: unknown; requirements: unknown; tender: TenderSummary | null }) {
  const container = pick(report, OVERVIEW_CONTAINERS); // e.g. data.tender_overview
  const reqInner = isObj(requirements) ? pick(requirements, ["requirements", "extracted_requirements"]) : undefined;
  const sources = [
    isObj(container) ? container : null,
    report,
    pick(requirements, OVERVIEW_CONTAINERS),
    requirements,
    isObj(reqInner) ? reqInner : null,
  ];
  // Keep any tender_overview fields the UI does not know about.
  const extra = isObj(container) ? omit(container, OVERVIEW_KEYS) : {};

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {OVERVIEW_FIELDS.map((f) => {
        const v = pickFrom(sources, f.keys);
        return (
          <div key={f.label} className={f.label === "Scope of supply" ? "md:col-span-2" : ""}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</p>
            <div className="mt-1 text-sm text-navy-900">
              {v === undefined ? (
                <Badge tone="amber">Not specified in backend response</Badge>
              ) : f.label === "Submission deadline" && typeof v === "string" ? (
                formatDate(v)
              ) : (
                <ValueView value={v} />
              )}
            </div>
          </div>
        );
      })}
      {tender?.filename && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Source document</p>
          <p className="mt-1 text-sm text-navy-900">{tender.filename}</p>
        </div>
      )}
      {container !== undefined && !isObj(container) && (
        <div className="md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overview</p>
          <div className="mt-1 text-sm"><ValueView value={container} /></div>
        </div>
      )}
      {Object.keys(extra).length > 0 && (
        <div className="md:col-span-2">
          <Collapsible title="Other overview fields from backend"><ValueView value={extra} /></Collapsible>
        </div>
      )}
    </div>
  );
}
