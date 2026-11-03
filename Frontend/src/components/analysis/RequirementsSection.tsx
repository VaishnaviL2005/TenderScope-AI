import { humanize, isEmpty, isObj, omit, pick, pickKey, type Obj } from "../../utils/data";
import { Badge, Collapsible, EmptyState, Notice } from "../common/ui";
import ValueView from "../common/ValueView";
import { OVERVIEW_CONTAINERS, OVERVIEW_KEYS } from "./TenderOverview";

const REQUIREMENT_FIELDS = [
  { label: "Product category", keys: ["product_category", "category", "product_type", "item_category"] },
  { label: "Voltage rating", keys: ["voltage_kv", "voltage_rating", "voltage", "voltage_grade", "rated_voltage"] },
  { label: "Conductor material", keys: ["conductor_material", "conductor", "conductor_type"] },
  { label: "Number of cores", keys: ["number_of_cores", "no_of_cores", "cores", "core_count", "num_cores"] },
  { label: "Cross-sectional area", keys: ["cross_section_mm2", "cross_sectional_area", "cross_section", "cross_sectional_area_sqmm", "csa", "conductor_size", "size"] },
  { label: "Insulation", keys: ["insulation", "insulation_type", "insulation_material"] },
  { label: "Armour", keys: ["armour", "armour_type", "armor", "armouring", "armoring"] },
  { label: "Applicable standards", keys: ["applicable_standards", "standards", "standard"] },
  { label: "Quantity", keys: ["quantity", "qty", "required_quantity"] },
  { label: "Testing requirements", keys: ["testing_requirements", "test_requirements", "tests", "testing", "required_tests"] },
];
const UNIT_KEYS = ["unit", "quantity_unit", "uom", "unit_of_measure"];
const TITLE_KEYS = ["item_name", "item_description", "description", "name", "item"];
const ITEM_KEYS = ["items", "line_items", "products", "requirement_items"];
const CONTAINER_KEYS = ["requirements", "extracted_requirements", "technical_requirements"];
const META_KEYS = ["tender_id", ...OVERVIEW_KEYS, ...OVERVIEW_CONTAINERS];

function split(data: unknown): { items: Obj[]; loose: unknown[]; general: Obj } {
  const fromList = (list: unknown[], general: Obj) => ({ items: list.filter(isObj), loose: list.filter((x) => !isObj(x)), general });
  if (Array.isArray(data)) return fromList(data, {});
  if (!isObj(data)) return { items: [], loose: isEmpty(data) ? [] : [data], general: {} };
  const ck = pickKey(data, CONTAINER_KEYS);
  if (ck) {
    const inner = data[ck];
    const general = omit(data, [ck]);
    if (Array.isArray(inner)) return fromList(inner, general);
    if (isObj(inner)) {
      const ik = pickKey(inner, ITEM_KEYS);
      if (ik && Array.isArray(inner[ik])) return fromList(inner[ik], { ...general, ...omit(inner, [ik]) });
      return { items: [inner], loose: [], general };
    }
    return { items: [], loose: [inner], general };
  }
  const ik = pickKey(data, ITEM_KEYS);
  if (ik && Array.isArray(data[ik])) return fromList(data[ik], omit(data, [ik]));
  return { items: [data], loose: [], general: {} };
}

function RequirementItem({ item, index, total }: { item: Obj; index: number; total: number }) {
  const used: string[] = [];
  const rows = REQUIREMENT_FIELDS.map((f) => {
    const k = pickKey(item, f.keys);
    if (k) used.push(k);
    return { label: f.label, key: k, value: k ? item[k] : undefined };
  });
  const unitKey = pickKey(item, UNIT_KEYS);
  if (unitKey) used.push(unitKey);
  const titleKey = pickKey(item, TITLE_KEYS);
  const title = titleKey && typeof item[titleKey] === "string" ? item[titleKey] : null;
  if (title && titleKey) used.push(titleKey);
  const extra = omit(item, [...used, ...META_KEYS]);
  const missing = rows.filter((r) => !r.key).length;

  return (
    <div className="print-break rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-sm font-semibold text-navy-900">
          {total > 1 ? `Requirement item ${index + 1} of ${total}` : "Requirement"}
          {title && <span className="ml-2 font-normal text-slate-600">{title}</span>}
        </p>
        {missing > 0 ? <Badge tone="amber">{missing} field{missing > 1 ? "s" : ""} not specified</Badge> : <Badge tone="teal">All key fields extracted</Badge>}
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{r.label}</dt>
            <dd className="mt-1 text-sm text-navy-900">
              {r.key === undefined ? (
                <Badge tone="amber">Not specified</Badge>
              ) : r.label === "Quantity" && unitKey && (typeof r.value === "number" || typeof r.value === "string") ? (
                `${r.value} ${String(item[unitKey])}`
              ) : (
                <ValueView value={r.value} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      {Object.keys(extra).length > 0 && (
        <div className="px-4 pb-4">
          <Collapsible title="Other extracted fields"><ValueView value={extra} /></Collapsible>
        </div>
      )}
    </div>
  );
}

export default function RequirementsSection({ data }: { data: unknown }) {
  const { items, loose, general } = split(data);
  // Tests belong to the tender rather than an individual product in the API.
  // Mirror them into a single-item summary without changing the source data.
  const itemsForDisplay = items.length === 1 && general.required_tests !== undefined ? [{ ...items[0], required_tests: general.required_tests }] : items;
  const generalExtra = omit(general, [...META_KEYS, ...(itemsForDisplay !== items ? ["required_tests"] : [])]);
  if (!items.length && !loose.length && !Object.keys(generalExtra).length) {
    return <EmptyState title="No requirements returned" message="The backend did not return extracted requirements for this tender." />;
  }
  return (
    <div className="space-y-4">
      {itemsForDisplay.map((it, i) => <RequirementItem key={i} item={it} index={i} total={itemsForDisplay.length} />)}
      {loose.length > 0 && (
        <Notice title="Additional requirement statements">
          <ValueView value={loose} />
        </Notice>
      )}
      {Object.keys(generalExtra).length > 0 && (
        <div className="space-y-3">
          {Object.entries(generalExtra).map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{humanize(k)}</p>
              <div className="mt-1 text-sm"><ValueView value={v} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { pick };
