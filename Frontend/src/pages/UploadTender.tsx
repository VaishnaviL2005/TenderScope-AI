import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { btn, Card, ErrorAlert, Notice, PageHeader, Spinner } from "../components/common/ui";
import FileDropzone from "../components/tender/FileDropzone";
import StatusBadge from "../components/tender/StatusBadge";
import { useTenderAnalysis } from "../hooks/useTenderAnalysis";
import { describeError, type ErrorInfo } from "../services/api";
import { extractStatus, getTender, getTenderStatus, normalizeTender, uploadTender } from "../services/tenderService";
import type { TenderSummary } from "../types/api";
import { formatDate } from "../utils/format";
import { statusKind } from "../utils/status";

const WORKFLOW = ["Upload Tender", "Analyze", "Technical Matching", "Cost Estimation", "Quality Review", "Final Report"];

function Elapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="tabular-nums">{Math.floor(s / 60)}m {String(s % 60).padStart(2, "0")}s elapsed</span>;
}

export default function UploadTender() {
  const [params, setParams] = useSearchParams();
  const presetId = params.get("tenderId");
  const navigate = useNavigate();
  const analysis = useTenderAnalysis();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<ErrorInfo | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [tender, setTender] = useState<TenderSummary | null>(null);
  const [tenderError, setTenderError] = useState<ErrorInfo | null>(null);
  const [loadingTender, setLoadingTender] = useState(false);
  const tenderRef = useRef<TenderSummary | null>(null);
  useEffect(() => {
    tenderRef.current = tender;
  }, [tender]);

  const reportPath = (id: string) => `/reports/${encodeURIComponent(id)}`;
  const openReport = (id: string) => navigate(reportPath(id));
  const checkStatus = (id: string) =>
    analysis.watch(id).then((ok) => {
      if (ok) openReport(id);
    });

  // Load an existing tender when arriving via ?tenderId= (Continue analysis / Check status).
  useEffect(() => {
    if (!presetId) {
      setTender(null);
      setTenderError(null);
      analysis.reset();
      return;
    }
    if (tenderRef.current?.tender_id === presetId) return;
    let active = true;
    (async () => {
      setLoadingTender(true);
      setTenderError(null);
      const [t, s] = await Promise.allSettled([getTender(presetId), getTenderStatus(presetId)]);
      if (!active) return;
      if (t.status === "rejected" && s.status === "rejected") {
        setTender(null);
        setTenderError(describeError(t.reason));
      } else {
        const base = t.status === "fulfilled" ? normalizeTender(t.value.data) : normalizeTender({ tender_id: presetId });
        const st = s.status === "fulfilled" ? extractStatus(s.value.data) : null;
        const merged: TenderSummary = { ...base, tender_id: base.tender_id || presetId, status: st ?? base.status };
        setTender(merged);
        if (statusKind(merged.status) === "processing") checkStatus(merged.tender_id);
      }
      setLoadingTender(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadTender(file);
      const t = normalizeTender(res.data);
      if (!t.tender_id) throw new Error("Upload succeeded, but the backend response did not include a tender_id.");
      const uploaded = { ...t, filename: t.filename ?? file.name, status: t.status ?? "uploaded" };
      setTender(uploaded);
      tenderRef.current = uploaded;
      setUploadMessage(res.message || "Tender uploaded successfully.");
      setFile(null);
      setParams({ tenderId: uploaded.tender_id }, { replace: true });
    } catch (e) {
      setUploadError(describeError(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!tender || analysis.busy) return;
    const ok = await analysis.run(tender.tender_id);
    if (ok) openReport(tender.tender_id);
  }

  function startOver() {
    setTender(null);
    tenderRef.current = null;
    setUploadMessage(null);
    setUploadError(null);
    setFile(null);
    analysis.reset();
    setParams({}, { replace: true });
  }

  const currentStatus = analysis.lastStatus ?? tender?.status ?? null;
  const kind = statusKind(currentStatus);
  const analyzeLabel = analysis.busy
    ? "Analyzing..."
    : kind === "failed" || analysis.phase === "failed"
    ? "Retry Analysis"
    : analysis.phase === "unconfirmed"
    ? "Run analysis again"
    : "Analyze Tender";

  return (
    <div className="space-y-6">
      <PageHeader title="Upload Tender" subtitle="Upload a tender / RFP document, then run the AI analysis." />

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {WORKFLOW.map((w, i) => (
          <span key={w} className="flex items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-navy-800 ring-1 ring-slate-200">{w}</span>
            {i < WORKFLOW.length - 1 && <span className="text-slate-300">&rarr;</span>}
          </span>
        ))}
      </div>

      <Card title="1. Tender document">
        {loadingTender ? (
          <Spinner label="Loading tender..." />
        ) : tenderError ? (
          <div className="space-y-3">
            <ErrorAlert error={tenderError} title={`Could not load tender ${presetId}`} />
            <button className={btn.secondary} onClick={startOver}>Upload a new tender instead</button>
          </div>
        ) : tender ? (
          <div className="space-y-4">
            {uploadMessage && <Notice tone="success" title={uploadMessage} />}
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Filename</dt>
                <dd className="mt-1 break-words text-sm font-medium text-navy-900">{tender.filename ?? "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Tender ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-navy-900">{tender.tender_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</dt>
                <dd className="mt-1 text-sm">{formatDate(tender.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
                <dd className="mt-1"><StatusBadge status={currentStatus} /></dd>
              </div>
            </dl>
            <button className={btn.secondary} onClick={startOver} disabled={analysis.busy}>Upload another tender</button>
          </div>
        ) : (
          <div className="space-y-4">
            <FileDropzone
              file={file}
              disabled={uploading}
              onSelect={(f, err) => {
                setFile(f);
                setFileError(err);
                setUploadError(null);
              }}
            />
            {fileError && <Notice tone="danger">{fileError}</Notice>}
            {uploadError && <ErrorAlert error={uploadError} title="Upload failed" />}
            <div className="flex items-center gap-3">
              <button className={btn.primary} onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? "Uploading..." : "Upload Tender"}
              </button>
              {uploading && <Spinner label="Uploading document to the backend..." />}
            </div>
          </div>
        )}
      </Card>

      {tender && (
        <Card title="2. Analyze tender" subtitle="Runs requirement extraction, technical matching, cost estimation and quality review on the backend.">
          <div className="space-y-4">
            {analysis.phase === "analyzing" && (
              <Notice tone="info" title="Analysis in progress">
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Spinner label="The backend runs the analysis synchronously; this request stays open until it finishes and can take several minutes. Keep this page open." />
                  <span className="text-xs text-navy-700"><Elapsed since={analysis.startedAt} /></span>
                </div>
              </Notice>
            )}
            {analysis.phase === "polling" && (
              <Notice tone="info" title="Confirming analysis status">
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Spinner label={`Checking status every few seconds. Current status: ${analysis.lastStatus ?? "unknown"}`} />
                  <span className="text-xs text-navy-700"><Elapsed since={analysis.startedAt} /></span>
                </div>
              </Notice>
            )}
            {analysis.phase === "unconfirmed" && (
              <Notice tone="warning" title="Completion not confirmed yet">
                <p>
                  The backend has not reported this analysis as completed (current status:{" "}
                  <span className="font-mono">{analysis.lastStatus ?? "unknown"}</span>). With a synchronous backend the status can
                  briefly lag behind the analysis request, so this is not treated as a failure.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={reportPath(tender.tender_id)} className={btn.primarySm}>Try opening the report</Link>
                  <button className={btn.secondarySm} onClick={() => checkStatus(tender.tender_id)}>Check status again</button>
                </div>
              </Notice>
            )}
            {analysis.error && <ErrorAlert error={analysis.error} title="Analysis did not complete" />}

            <div className="flex flex-wrap gap-3">
              {kind === "completed" && !analysis.busy ? (
                <Link to={reportPath(tender.tender_id)} className={btn.primary}>Open analysis report</Link>
              ) : (
                <button className={btn.primary} onClick={handleAnalyze} disabled={analysis.busy || kind === "processing"}>
                  {analyzeLabel}
                </button>
              )}
              {kind === "processing" && !analysis.busy && (
                <button className={btn.secondary} onClick={() => checkStatus(tender.tender_id)}>Check status</button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
