import { DASH, collect, humanize, isEmpty, isObj, omit, pick, pickKey, toArray, type Obj } from "../../utils/data";
import { formatINR, isMoneyKey } from "../../utils/format";
import { Badge, Collapsible, EmptyState, Notice } from "../common/ui";
import ValueView from "../common/ValueView";

const MATERIAL_KEYS = ["material_cost", "total_material_cost", "material_total"];
const TESTING_KEYS = ["testing_cost", "total_testing_cost", "testing_total"];
const TOTAL_KEYS = ["total_estimated_cost", "total_cost", "grand_total", "estimated_total", "total"];
const ITEM_KEYS = ["items", "line_items", "item_breakdown", "item_wise_breakdown", "breakdown", "pricing_breakdown", "item_pricing"];
const WARNING_KEYS = ["missing_price_warnings", "missing_prices", "warnings", "pricing_warnings"];

function Money({ value }: { value: unknown }) {
  if (isEmpty(value)) return <Badge tone="amber">Not available</Badge>;
  const f = formatINR(value);
  return f ? <span className="tabular-nums">{f}</span> : <ValueView value={value} />;
}

function Tile({ label, value, highlight }: { label: string; value: unknown; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-navy-800 bg-navy-900 text-white" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${highlight ? "text-navy-200" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-white" : "text-navy-900"}`}><Money value={value} /></p>
    </div>
  );
}

export default function PricingSection({ pricing }: { pricing: unknown }) {
  if (!isObj(pricing)) {
    return (
      <div className="space-y-4">
        <Notice tone="warning"><strong>Estimated pricing - Not an official commercial quotation.</strong></Notice>
        <EmptyState title="No pricing results" message="The report does not contain pricing_results." />
      </div>
    );
  }
  const itemsKey = pickKey(pricing, ITEM_KEYS);
  const items = itemsKey ? toArray(pricing[itemsKey]) : [];
  const objItems: Obj[] = items.filter(isObj);
  const columns: string[] = [];
  objItems.forEach((it) => Object.keys(it).forEach((k) => !columns.includes(k) && columns.push(k)));
  const warnings = collect(pricing, WARNING_KEYS);
  const extra = omit(pricing, [...MATERIAL_KEYS, ...TESTING_KEYS, ...TOTAL_KEYS, ...WARNING_KEYS, ...(itemsKey ? [itemsKey] : [])]);

  return (
    <div className="space-y-5">
      <Notice tone="warning"><strong>Estimated pricing - Not an official commercial quotation.</strong> Figures are shown exactly as calculated by the Pricing Agent.</Notice>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Material cost" value={pick(pricing, MATERIAL_KEYS)} />
        <Tile label="Testing cost" value={pick(pricing, TESTING_KEYS)} />
        <Tile label="Total estimated cost" value={pick(pricing, TOTAL_KEYS)} highlight />
      </div>

      {warnings.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-navy-900">Missing-price and pricing warnings</h4>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {isObj(w) || Array.isArray(w) ? <ValueView value={w} /> : String(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-navy-900">Item-wise pricing breakdown</h4>
        {objItems.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>{columns.map((c) => <th key={c} className={`px-3 py-2 ${isMoneyKey(c) ? "text-right" : ""}`}>{humanize(c)}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {objItems.map((it, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className={`px-3 py-2 align-top ${isMoneyKey(c) ? "text-right" : ""}`}>
                        {isMoneyKey(c) ? (isEmpty(it[c]) ? <Badge tone="amber">Price missing</Badge> : <Money value={it[c]} />) : it[c] === undefined ? <span className="text-slate-400">{DASH}</span> : <ValueView value={it[c]} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : items.length ? (
          <ValueView value={items} />
        ) : (
          <p className="text-sm text-slate-500">No item-wise breakdown returned.</p>
        )}
      </div>

      {Object.keys(extra).length > 0 && <Collapsible title="Other Pricing Agent output"><ValueView value={extra} /></Collapsible>}
    </div>
  );
}
