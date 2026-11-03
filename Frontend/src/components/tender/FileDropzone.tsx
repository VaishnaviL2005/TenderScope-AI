import { useRef, useState } from "react";
import { formatBytes } from "../../utils/format";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function validateTenderFile(file: File): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return `"${file.name}" is not supported. Upload a PDF, DOCX or TXT file.`;
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_FILE_BYTES) return `File is ${formatBytes(file.size)}. The maximum allowed size is 25 MB.`;
  return null;
}

export default function FileDropzone({ file, onSelect, disabled }: { file: File | null; onSelect: (file: File | null, error: string | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    if (list.length > 1) return onSelect(null, "Please upload one tender document at a time.");
    const f = list[0];
    const err = validateTenderFile(f);
    onSelect(err ? null : f, err);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
        dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-navy-400 hover:bg-white"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <svg className="h-10 w-10 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="mt-3 text-sm font-semibold text-navy-900">Drag and drop your tender / RFP document here</p>
      <p className="mt-1 text-sm text-slate-500">or <span className="font-medium text-navy-700 underline">browse files</span></p>
      <p className="mt-3 text-xs text-slate-400">PDF, DOCX or TXT | Maximum 25 MB</p>
      {file && (
        <p className="mt-4 rounded-md bg-white px-3 py-1.5 text-sm text-navy-800 ring-1 ring-slate-200">
          Selected: <span className="font-medium">{file.name}</span> ({formatBytes(file.size)})
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
