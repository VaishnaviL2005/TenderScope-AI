import { DASH, collect, humanize, isObj, omit, pick, pickKey, toNumber, type Obj } from "../../utils/data";
import { verdict, type Verdict } from "../../utils/status";
import { Badge, Collapsible, EmptyState, Notice } from "../common/ui";
import ValueView from "../common/ValueView";
import SourceList from "./SourceList";

const RANK_KEYS = ["rank", "ranking", "position"];
const SKU_KEYS = ["sku_id", "sku", "sku_code", "product_sku", "product_id"];
const NAME_KEYS = ["product_name", "name", "product", "product_description"];
const MATCH_KEYS = ["match_percentage", "match_percent", "match_score", "score"];
const COMPLIANCE_KEYS = ["compliant", "is_compliant", "compliance", "compliance_status"];
const COMPARISON_KEYS = ["parameter_comparisons", "parameter_comparison", "parameter_wise_comparison", "comparisons", "comparison", "parameter_matches", "specification_comparison"];
const WARNING_KEYS = ["compliance_warnings", "warnings", "issues", "non_compliances"];
const SOURCE_KEYS = ["source_references", "sources", "references", "citations"];
const USED_KEYS = [...RANK_KEYS, ...SKU_KEYS, ...NAME_KEYS, ...MATCH_KEYS, ...COMPLIANCE_KEYS, ...COMPARISON_KEYS, ...WARNING_KEYS, ...SOURCE_KEYS];

interface CompRow { parameter: string; required: unknown; offered: unknown; status: unknown; note: unknown }

function first(obj: Obj, keys: string[]): unknown {
  const k = keys.find((key) => Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== undefined);
  return k === undefined ? undefined : obj[k];
}

function toRow(x: Obj, fallback: string): CompRow {
  return {
    parameter: String(pick(x, ["parameter", "parameter_name", "name", "param", "attribute", "field", "specification"]) ?? fallback),
    required: pick(x, ["required", "required_value", "tender_value", "tender_requirement", "requirement", "expected"]),
    offered: pick(x, ["offered", "offered_value", "product_value", "product_spec", "actual", "value"]),
    status: first(x, ["match", "matched", "is_match", "status", "compliant", "result", "compliance"]),
    note: pick(x, ["remarks", "remark", "note", "notes", "comment", "reason", "message", "explanation"]),
  };
}

function comparisonRows(v: unknown): CompRow[] {
  if (Array.isArray(v)) return v.map((x, i) => (isObj(x) ? toRow(x, `Parameter ${i + 1}`) : { parameter: String(x), required: undefined, offered: undefined, status: undefined, note: undefined }));
  if (isObj(v)) {
    return Object.entries(v).map(([k, val]) =>
      isObj(val) ? toRow(val, humanize(k)) : { parameter: humanize(k), required: undefined, offered: undefined, status: val, note: undefined }
    );
  }
  return [];
}

function VerdictBadge({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <span className="text-slate-400">{DASH}</span>;
  const v = verdict(value);
  if (v === true) return <Badge tone="teal">{typeof value === "string" ? value : "Match"}</Badge>;
  if (v === false) return <Badge tone="red">{typeof value === "string" ? value : "Mismatch"}</Badge>;
  if (v === "partial") return <Badge tone="amber">{String(value)}</Badge>;
  return <Badge tone="slate">{String(value)}</Badge>;
}

function ComplianceBadge({ present, value, raw }: { present: boolean; value: Verdict; raw: unknown }) {
  if (!present) return <Badge tone="slate">Compliance not reported</Badge>;
  if (value === false) return <Badge tone="redSolid">NON-COMPLIANT</Badge>;
  if (value === true) return <Badge tone="teal">Compliant</Badge>;
  if (value === "partial") return <Badge tone="amber">{String(raw)}</Badge>;
  return <Badge tone="slate">{String(raw)}</Badge>;
}

function MatchBar({ value }: { value: unknown }) {
  const n = toNumber(value);
  if (n === null) return <span className="text-sm text-slate-400">{value === undefined ? "Not reported" : String(value)}</span>;
  const width = Math.max(0, Math.min(100, n));
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-navy-600" style={{ width: `${width}%` }} />
      </div>
      <span className="w-14 text-right text-sm font-semibold tabular-nums text-navy-900">{n}%</span>
    </div>
  );
}

function extract(rec: Obj, index: number) {
  const complianceKey = pickKey(rec, COMPLIANCE_KEYS) ?? (Object.prototype.hasOwnProperty.call(rec, "compliant") ? "compliant" : undefined);
  const rawCompliance = complianceKey ? rec[complianceKey] : undefined;
  const name = pick(rec, NAME_KEYS);
  return {
    rank: pick(rec, RANK_KEYS),
    position: index + 1,
    sku: pick(rec, SKU_KEYS),
    name: typeof name === "string" ? name : undefined,
    nameRaw: name,
    match: pick(rec, MATCH_KEYS),
    compliancePresent: complianceKey !== undefined,
    compliance: complianceKey ? verdict(rawCompliance) : null,
    rawCompliance,
    comparisons: comparisonRows(pick(rec, COMPARISON_KEYS)),
    warnings: collect(rec, WARNING_KEYS),
    sources: collect(rec, SOURCE_KEYS),
    extra: omit(rec, USED_KEYS),
  };
}

function RecommendationCard({ rec, index }: { rec: Obj; index: number }) {
  const r = extract(rec, index);
  const nonCompliant = r.compliance === false;
  return (
    <article className={`print-break rounded-xl border ${nonCompliant ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"} bg-white`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-white" title={r.rank === undefined ? "Position in backend list (no explicit rank field)" : "Rank"}>
            #{r.rank !== undefined ? String(r.rank) : r.position}
          </div>
          <div>
            <p className="font-semibold text-navy-900">{r.name ?? (r.nameRaw === undefined ? "Product name not provided" : "Product")}</p>
            <p className="font-mono text-xs text-slate-500">SKU: {r.sku !== undefined ? String(r.sku) : "Not provided"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ComplianceBadge present={r.compliancePresent} value={r.compliance} raw={r.rawCompliance} />
          <MatchBar value={r.match} />
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        {nonCompliant && (
          <Notice tone="danger" title="This product is marked NOT compliant by the Technical Agent.">
            Review the parameter comparison and warnings below before considering it.
          </Notice>
        )}
        {r.nameRaw !== undefined && r.name === undefined && <ValueView value={r.nameRaw} />}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-navy-900">Parameter-wise comparison</h4>
          {r.comparisons.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Parameter</th>
                    <th className="px-3 py-2">Tender requirement</th>
                    <th className="px-3 py-2">Product value</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.comparisons.map((c, i) => (
                    <tr key={i} className={verdict(c.status) === false ? "bg-red-50/60" : verdict(c.status) === "partial" ? "bg-amber-50/60" : ""}>
                      <td className="px-3 py-2 font-medium text-navy-900">{c.parameter}</td>
                      <td className="px-3 py-2"><ValueView value={c.required} /></td>
                      <td className="px-3 py-2"><ValueView value={c.offered} /></td>
                      <td className="px-3 py-2"><VerdictBadge value={c.status} /></td>
                      <td className="px-3 py-2 text-slate-600"><ValueView value={c.note} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No parameter comparison returned for this product.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-navy-900">Compliance warnings</h4>
          {r.warnings.length ? (
            <ul className="space-y-1.5">
              {r.warnings.map((w, i) => (
                <li key={i} className={`rounded-md border px-3 py-2 text-sm ${nonCompliant ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {isObj(w) || Array.isArray(w) ? <ValueView value={w} /> : String(w)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No warnings reported by the backend.</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-navy-900">Source references</h4>
          {r.sources.length ? <SourceList sources={r.sources} /> : <p className="text-sm text-slate-500">No source references returned.</p>}
        </div>

        {Object.keys(r.extra).length > 0 && <Collapsible title="Additional details"><ValueView value={r.extra} /></Collapsible>}
      </div>
    </article>
  );
}

export default function RecommendationsSection({ technical }: { technical: unknown }) {
  // Supports data.technical_results.recommendations, or technical_results given directly as a list.
  const hasTechnical = isObj(technical) || Array.isArray(technical);
  const recsRaw = Array.isArray(technical) ? technical : isObj(technical) ? technical.recommendations : undefined;
  const list: unknown[] = Array.isArray(recsRaw) ? recsRaw : recsRaw === undefined || recsRaw === null ? [] : [recsRaw];
  const recs: Obj[] = list.filter(isObj);
  const looseRecs = list.filter((x) => !isObj(x));
  const other = isObj(technical) ? omit(technical, ["recommendations"]) : {};

  const allRanked = recs.length > 0 && recs.every((r) => toNumber(pick(r, RANK_KEYS)) !== null);
  const ordered = allRanked ? [...recs].sort((a, b) => (toNumber(pick(a, RANK_KEYS)) ?? 0) - (toNumber(pick(b, RANK_KEYS)) ?? 0)) : recs;

  return (
    <div className="space-y-5">
      <Notice tone="info">
        <strong>Match percentage is a ranking score, not a compliance guarantee.</strong> Always check compliance status and warnings.
      </Notice>

      {!hasTechnical ? (
        technical === undefined || technical === null || technical === "" ? (
          <EmptyState title="No technical results" message="The report does not contain technical_results." />
        ) : (
          <ValueView value={technical} />
        )
      ) : ordered.length === 0 && looseRecs.length === 0 ? (
        <EmptyState title="No product recommendations" message="The Technical Agent returned no matching products for this tender." />
      ) : (
        <>
          {ordered.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">SKU ID</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">Compliance</th>
                    <th className="px-3 py-2">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ordered.map((rec, i) => {
                    const r = extract(rec, i);
                    return (
                      <tr key={i} className={r.compliance === false ? "bg-red-50/50" : ""}>
                        <td className="px-3 py-2 font-semibold">#{r.rank !== undefined ? String(r.rank) : r.position}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.sku !== undefined ? String(r.sku) : DASH}</td>
                        <td className="px-3 py-2">{r.name ?? DASH}</td>
                        <td className="px-3 py-2"><MatchBar value={r.match} /></td>
                        <td className="px-3 py-2"><ComplianceBadge present={r.compliancePresent} value={r.compliance} raw={r.rawCompliance} /></td>
                        <td className="px-3 py-2">{r.warnings.length ? <Badge tone={r.compliance === false ? "red" : "amber"}>{r.warnings.length}</Badge> : <span className="text-slate-400">0</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ordered.map((rec, i) => <RecommendationCard key={i} rec={rec} index={i} />)}
          {looseRecs.length > 0 && (
            <Collapsible title="Recommendations in an unrecognised format"><ValueView value={looseRecs} /></Collapsible>
          )}
        </>
      )}

      {Object.keys(other).length > 0 && <Collapsible title="Other Technical Agent output"><ValueView value={other} /></Collapsible>}
    </div>
  );
}
