import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import PricingSection from "../components/analysis/PricingSection";
import QualityReviewSection from "../components/analysis/QualityReviewSection";
import RecommendationsSection from "../components/analysis/RecommendationsSection";
import RequirementsSection from "../components/analysis/RequirementsSection";
import TenderOverview, { OVERVIEW_CONTAINERS } from "../components/analysis/TenderOverview";
import TenderChat from "../components/chat/TenderChat";
import { btn, Card, Collapsible, EmptyState, ErrorAlert, Notice, PageHeader, Spinner } from "../components/common/ui";
import ValueView from "../components/common/ValueView";
import StatusBadge from "../components/tender/StatusBadge";
import { useAsync, type AsyncState } from "../hooks/useAsync";
import { useTenderAnalysis } from "../hooks/useTenderAnalysis";
import type { ErrorInfo } from "../services/api";
import { getReport, getRequirements, type RequirementsResult } from "../services/reportService";
import { extractStatus, getTender, getTenderStatus, normalizeTender } from "../services/tenderService";
import { isEmpty, isObj, omit, pick, type Obj } from "../utils/data";
import { formatDate } from "../utils/format";
import { statusKind } from "../utils/status";

const MAX_STATUS_POLLS = 120; // ~10 minutes at 5 s
const NOT_READY_HTTP = [404, 409];
const REPORT_REQUIREMENT_KEYS = ["extracted_requirements", "requirements"];
const SUMMARY_KEYS = ["executive_summary", "summary", "final_summary", "overall_summary", "final_report"];
const HANDLED_REPORT_KEYS = [
  "technical_results", "pricing_results", "quality_review", "tender_id", "disclaimer",
  ...REPORT_REQUIREMENT_KEYS, ...SUMMARY_KEYS, ...OVERVIEW_CONTAINERS,
];

function Block({ state, label, children }: { state: { loading: boolean; error: ErrorInfo | null; reload: () => void }; label: string; children: ReactNode }) {
  if (state.loading) return <Spinner label={`Loading ${label}...`} />;
  if (state.error) return <ErrorAlert error={state.error} title={`Could not load ${label}`} onRetry={state.reload} />;
  return <>{children}</>;
}

export default function TenderReport() {
  const { tenderId = "" } = useParams();
  const status = useAsync(() => getTenderStatus(tenderId).then((r) => r.data), [tenderId], !!tenderId);
  const statusLoaded = status.data !== null && status.data !== undefined;
  const statusStr = extractStatus(status.data);
  const kind = statusKind(statusStr);
  const completed = kind === "completed";
  // Also try the report for "uploaded"/unknown so a just-finished synchronous analysis shows even if /status lags.
  const fetchReport = statusLoaded && kind !== "processing" && kind !== "failed";

  const info = useAsync(() => getTender(tenderId).then((r) => normalizeTender(r.data)), [tenderId], !!tenderId);
  const report: AsyncState<any> = useAsync(() => getReport(tenderId).then((r) => r.data), [tenderId], fetchReport);
  // Independent of the report: a missing /requirements endpoint never blocks other sections.
  const reqs: AsyncState<RequirementsResult> = useAsync(() => getRequirements(tenderId), [tenderId], fetchReport);
  const reanalysis = useTenderAnalysis();
  const [reanalysisSuccess, setReanalysisSuccess] = useState<string | null>(null);

  const polls = useRef(0);
  useEffect(() => {
    polls.current = 0;
  }, [tenderId]);
  useEffect(() => {
    if (kind !== "processing" || polls.current >= MAX_STATUS_POLLS) return;
    const t = window.setTimeout(() => {
      polls.current += 1;
      status.reload();
    }, 5000);
    return () => window.clearTimeout(t);
  }, [kind, status.data, status.reload]);

  const repRaw = report.data;
  const rep: Obj = isObj(repRaw) ? (isObj(repRaw.report) && !repRaw.technical_results ? repRaw.report : repRaw) : {};
  const reportShown = completed || (isObj(repRaw) && !report.error);
  const summary = pick(rep, SUMMARY_KEYS);
  const disclaimer = rep.disclaimer;
  const additional = omit(rep, HANDLED_REPORT_KEYS);
  const generatedAt = pick(rep, ["generated_at", "created_at", "completed_at", "analyzed_at"]);

  const reportRequirements = pick(rep, REPORT_REQUIREMENT_KEYS);
  const endpointRequirements = reqs.data && reqs.data.available ? reqs.data.data : undefined;
  const useEndpointRequirements = endpointRequirements !== undefined && !isEmpty(endpointRequirements);
  const effectiveRequirements = useEndpointRequirements ? endpointRequirements : reportRequirements;

  if (!tenderId) return <EmptyState title="No tender selected" action={<Link to="/reports" className={btn.primary}>Analysis Reports</Link>} />;

  const refreshAll = () => {
    status.reload();
    report.reload();
    reqs.reload();
    info.reload();
  };

  const reanalyzeTender = async () => {
    if (!window.confirm("Are you sure you want to re-analyze this tender?")) return;
    setReanalysisSuccess(null);
    const succeeded = await reanalysis.run(tenderId);
    if (succeeded) {
      refreshAll();
      setReanalysisSuccess("Updated report is ready.");
    }
  };

  const header = (
    <PageHeader
      title="Tender Analysis Report"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-xs">ID: {tenderId}</span>
          {info.data?.filename && <span>{info.data.filename}</span>}
          {statusStr && <StatusBadge status={statusStr} />}
          {generatedAt && <span className="text-xs">Generated {formatDate(generatedAt)}</span>}
        </span>
      }
      actions={
        <>
          <Link to="/history" className={btn.secondary}>Back to history</Link>
          <button className={btn.primary} onClick={reanalyzeTender} disabled={reanalysis.busy || kind === "processing"}>
            {reanalysis.busy ? "Re-analyzing…" : "Re-analyze Tender"}
          </button>
          {reportShown && <button className={btn.primary} onClick={() => window.print()}>Print / Save as PDF</button>}
        </>
      }
    />
  );

  const notReady = (reportError: ErrorInfo | null = null) => {
    const encoded = encodeURIComponent(tenderId);
    return (
      <div className="space-y-6">
        {header}
        <Card title="Report not available yet">
          {kind === "processing" ? (
            <Notice tone="info" title="Analysis is still running">
              <Spinner label={polls.current >= MAX_STATUS_POLLS ? "Automatic checks stopped. Use Refresh." : "This page re-checks the status every 5 seconds."} />
            </Notice>
          ) : kind === "failed" ? (
            <Notice tone="danger" title="The last analysis failed.">
              {(() => {
                const reason = isObj(status.data) ? pick(status.data, ["error", "error_message", "failure_reason", "details", "message"]) : undefined;
                return reason ? <ValueView value={reason} /> : "No failure details were returned.";
              })()}
            </Notice>
          ) : (
            <Notice tone="warning" title={`Current status: ${statusStr ?? "unknown"}`}>
              The backend has not returned a report for this tender yet. The report is generated after the analysis completes.
            </Notice>
          )}
          {reportError && !NOT_READY_HTTP.includes(reportError.status ?? 0) && (
            <div className="mt-4"><ErrorAlert error={reportError} title="Report request failed" /></div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn.secondary} onClick={refreshAll}>Refresh status</button>
            {kind !== "processing" && (
              <Link to={`/upload?tenderId=${encoded}`} className={btn.primary}>{kind === "failed" ? "Retry analysis" : "Analyze tender"}</Link>
            )}
          </div>
        </Card>
      </div>
    );
  };

  const renderRequirements = (): ReactNode => {
    if (reqs.loading) return <Spinner label="Loading requirements..." />;
    if (useEndpointRequirements) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Source: GET /tenders/{"{tender_id}"}/requirements</p>
          <RequirementsSection data={endpointRequirements} />
        </div>
      );
    }
    if (report.loading) return <Spinner label="Loading requirements from the report..." />;
    if (reportRequirements !== undefined) {
      return (
        <div className="space-y-3">
          {reqs.error && (
            <Notice tone="warning" title="The requirements endpoint returned an error; showing the requirements included in the report.">
              {reqs.error.message}
              {reqs.error.status ? ` (HTTP ${reqs.error.status})` : ""}
            </Notice>
          )}
          <p className="text-xs text-slate-500">Source: analysis report (extracted_requirements)</p>
          <RequirementsSection data={reportRequirements} />
        </div>
      );
    }
    if (reqs.error) return <ErrorAlert error={reqs.error} title="Could not load requirements" onRetry={reqs.reload} />;
    return <RequirementsSection data={endpointRequirements} />;
  };

  if (status.loading && !statusLoaded) return <>{header}<Spinner label="Checking analysis status..." /></>;
  if (status.error && !statusLoaded) return <>{header}<ErrorAlert error={status.error} title="Could not load tender status" onRetry={status.reload} /></>;
  if (!fetchReport) return notReady();
  if (!completed) {
    if (report.loading) return <>{header}<Spinner label="Checking whether a report is available..." /></>;
    if (!reportShown) return notReady(report.error);
  }

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <p className="text-lg font-bold text-navy-900">TenderScope AI</p>
        <p className="text-xs text-slate-500">Intelligent Tender Analysis. Smarter Product Decisions.</p>
      </div>
      {header}

      {reanalysis.busy && <Notice tone="info" title="Re-analysis in progress">The existing tender document is being analyzed again. The report refreshes automatically when it is ready.</Notice>}
      {reanalysisSuccess && <Notice tone="success" title={reanalysisSuccess}>Extracted requirements, recommendations, pricing, and Quality Review have been refreshed.</Notice>}
      {reanalysis.error && <ErrorAlert error={reanalysis.error} title="Re-analysis failed" />}

      {!completed && (
        <Notice tone="info" title={`Status reported by the backend: ${statusStr ?? "unknown"}`}>
          The backend returned a report for this tender, so it is shown exactly as returned.
        </Notice>
      )}

      {!isEmpty(disclaimer) && (
        <Notice tone="warning" title="Disclaimer">
          <ValueView value={disclaimer} />
        </Notice>
      )}

      <Card title="1. Tender Overview">
        <Block state={report} label="report">
          <TenderOverview report={rep} requirements={effectiveRequirements} tender={info.data} />
          {summary !== undefined && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Report summary</p>
              <div className="text-sm"><ValueView value={summary} /></div>
            </div>
          )}
        </Block>
      </Card>

      <Card title="2. Extracted Requirements" subtitle="Fields not found in the tender are shown as Not specified.">
        {renderRequirements()}
      </Card>

      <Card title="3. Technical Agent - Product Recommendations">
        <Block state={report} label="report">
          <RecommendationsSection technical={rep.technical_results} />
        </Block>
      </Card>

      <Card title="4. Pricing Agent - Cost Estimation">
        <Block state={report} label="report">
          <PricingSection pricing={rep.pricing_results} />
        </Block>
      </Card>

      <Card title="5. Quality Review">
        <Block state={report} label="report">
          <QualityReviewSection quality={rep.quality_review} />
        </Block>
      </Card>

      {report.data && Object.keys(additional).length > 0 && (
        <Collapsible title="Additional report data from backend"><ValueView value={additional} /></Collapsible>
      )}

      <Card title="6. Report Export" className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Use your browser print dialog and choose "Save as PDF" as the destination. Navigation and Q&A are hidden in the printout.</p>
          <button className={btn.primary} onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </Card>

      <TenderChat key={tenderId} tenderId={tenderId} />
    </div>
  );
}
