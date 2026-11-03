import { Link } from "react-router-dom";
import type { TenderSummary } from "../../types/api";
import { statusKind } from "../../utils/status";
import { btn } from "../common/ui";

export default function TenderActions({ tender }: { tender: TenderSummary }) {
  if (!tender.tender_id) return null;
  const id = encodeURIComponent(tender.tender_id);
  const kind = statusKind(tender.status);
  if (kind === "completed") return <Link className={btn.primarySm} to={`/reports/${id}`}>Open report</Link>;
  if (kind === "processing") return <Link className={btn.secondarySm} to={`/upload?tenderId=${id}`}>Check status</Link>;
  if (kind === "failed") return <Link className={btn.secondarySm} to={`/upload?tenderId=${id}`}>Retry analysis</Link>;
  return <Link className={btn.secondarySm} to={`/upload?tenderId=${id}`}>Continue analysis</Link>;
}
