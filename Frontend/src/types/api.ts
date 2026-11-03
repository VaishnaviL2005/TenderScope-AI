// Backend schemas are read defensively; see README "Adapting to the exact Swagger schema".
export interface ApiEnvelope<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorData {
  error_code?: string;
  details?: unknown;
}

export interface TenderSummary {
  tender_id: string; // always kept as a string, exactly as returned
  filename: string | null;
  created_at: string | null;
  status: string | null;
  raw: Record<string, any>;
}

export interface TenderPage {
  items: TenderSummary[];
  total: number | null;
  page: number;
  page_size: number;
  total_pages: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  sources?: any[];
  raw?: any;
  at: string;
}
