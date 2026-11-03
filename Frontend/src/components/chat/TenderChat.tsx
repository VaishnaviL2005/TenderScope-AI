import { useEffect, useRef, useState } from "react";
import { describeError } from "../../services/api";
import { askQuestion } from "../../services/questionService";
import type { ChatMessage } from "../../types/api";
import { collect, isObj, pick } from "../../utils/data";
import SourceList from "../analysis/SourceList";
import { btn, Card, Spinner } from "../common/ui";
import ValueView from "../common/ValueView";

const SUGGESTED = [
  "Why was Product B ranked second?",
  "Which specifications does Product A fail?",
  "Compare the top two products.",
  "Which testing procedures are required?",
  "How was the total cost calculated?",
];

const storageKey = (id: string) => `tenderscope:chat:${id}`;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function load(id: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Q&A bound to one tender ID. Render with key={tenderId}. */
export default function TenderChat({ tenderId }: { tenderId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => load(tenderId));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(tenderId), JSON.stringify(messages));
    } catch {
      /* storage unavailable */
    }
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, tenderId]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || sending) return;
    const now = () => new Date().toISOString();
    setMessages((m) => [...m, { id: uid(), role: "user", text: question, at: now() }]);
    setInput("");
    setSending(true);
    try {
      const res = await askQuestion(tenderId, question);
      const d = res.data;
      const answer = typeof d === "string" ? d : pick(d, ["answer", "response", "text", "result"]);
      const sources = isObj(d) ? collect(d, ["sources", "source_references", "references", "citations"]) : [];
      setMessages((m) => [
        ...m,
        { id: uid(), role: "assistant", text: typeof answer === "string" ? answer : "", raw: typeof answer === "string" ? undefined : d, sources, at: now() },
      ]);
    } catch (e) {
      const info = describeError(e);
      const extra = [info.status ? `HTTP ${info.status}` : "", info.code ?? "", info.details ?? ""].filter(Boolean).join("\n");
      setMessages((m) => [...m, { id: uid(), role: "error", text: info.message + (extra ? `\n${extra}` : ""), at: now() }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card
      className="print:hidden"
      title="Tender Q&A (optional)"
      subtitle={<>Ask questions about this tender. Answers come from the backend for tender <span className="font-mono">{tenderId}</span>.</>}
      actions={messages.length > 0 && <button className={btn.ghostSm} onClick={() => setMessages([])} disabled={sending}>Clear chat</button>}
    >
      <div ref={listRef} className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-slate-500">No questions yet. Try one of the suggestions below.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-navy-800 text-white" : m.role === "error" ? "border border-red-200 bg-red-50 text-red-800" : "border border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {m.role === "error" && <p className="mb-1 text-xs font-semibold uppercase">Request failed</p>}
              {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : m.raw !== undefined ? <ValueView value={m.raw} /> : <p className="text-slate-400">Empty answer returned.</p>}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                  <SourceList sources={m.sources} />
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <Spinner label="Waiting for the backend answer..." />}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={sending} className="rounded-full border border-navy-200 bg-navy-50 px-3 py-1 text-xs font-medium text-navy-800 hover:bg-navy-100 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about requirements, products, compliance or cost..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
          disabled={sending}
        />
        <button type="submit" className={btn.primary} disabled={sending || !input.trim()}>Ask</button>
      </form>
    </Card>
  );
}
