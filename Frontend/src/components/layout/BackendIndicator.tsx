import { useHealth } from "../../hooks/useHealth";
import { API_BASE_URL } from "../../services/api";

export default function BackendIndicator() {
  const h = useHealth(30000);
  const state = h.loading ? "checking" : h.reachable ? (h.degraded ? "degraded" : "online") : "offline";
  const dot = { checking: "bg-slate-400 animate-pulse", online: "bg-teal-400", degraded: "bg-amber-400", offline: "bg-red-500" }[state];
  const label = { checking: "Checking...", online: "Connected", degraded: "Degraded", offline: "Unreachable" }[state];

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <span className="font-medium text-white">Backend: {label}</span>
        </div>
        <button onClick={h.refresh} className="rounded px-1.5 py-0.5 text-navy-200 hover:bg-white/10 hover:text-white">Recheck</button>
      </div>
      <div className="mt-1 truncate text-[11px] text-navy-300" title={h.error ?? API_BASE_URL}>{API_BASE_URL}</div>
    </div>
  );
}
