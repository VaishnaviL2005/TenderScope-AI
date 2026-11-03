import { DASH } from "../../utils/data";
import { STATUS_STYLES, statusKind } from "../../utils/status";

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const kind = statusKind(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[kind]}`}>
      {status ? String(status).replace(/_/g, " ") : DASH}
    </span>
  );
}
