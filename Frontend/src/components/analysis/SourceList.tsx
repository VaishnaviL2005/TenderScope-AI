import { isObj, pick } from "../../utils/data";
import ValueView from "../common/ValueView";

export default function SourceList({ sources }: { sources: any[] }) {
  if (!sources.length) return null;
  return (
    <ul className="space-y-1.5">
      {sources.map((s, i) => {
        if (!isObj(s)) {
          return <li key={i} className="rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200">{String(s)}</li>;
        }
        const doc = pick(s, ["document", "source", "file", "filename", "title", "name", "doc", "doc_id", "source_id"]);
        const page = pick(s, ["page", "page_number", "page_no"]);
        const section = pick(s, ["section", "clause", "chunk_id"]);
        const snippet = pick(s, ["snippet", "text", "content", "excerpt", "chunk", "quote"]);
        const score = pick(s, ["score", "relevance", "similarity"]);
        const known = doc !== undefined || snippet !== undefined;
        return (
          <li key={i} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
            {known ? (
              <>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-medium text-navy-800">
                  {doc !== undefined && <span>{String(doc)}</span>}
                  {page !== undefined && <span className="text-slate-500">Page {String(page)}</span>}
                  {section !== undefined && <span className="text-slate-500">{String(section)}</span>}
                  {score !== undefined && <span className="text-slate-500">Score {String(score)}</span>}
                </div>
                {snippet !== undefined && <p className="mt-1 whitespace-pre-wrap text-slate-600">{String(snippet)}</p>}
              </>
            ) : (
              <ValueView value={s} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
