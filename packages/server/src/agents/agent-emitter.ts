/**
 * AgentEmitter — Progress callback interface for sub-agent operations.
 *
 * Decouples agents (Loci, asset-generator) from SSE transport.
 * The SSE handler in ai.ts creates a concrete implementation that
 * calls sendSSE(); agents just call emitter?.progress() etc.
 *
 * All methods are optional-call safe — guard with `emitter?.method(...)`.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface AgentProgressEvent {
  /** Phase of work (e.g., 'proposal', 'refine', 'scoring') */
  phase: string
  /** Current step number (e.g., 1 of 3) */
  current?: number
  /** Total steps expected */
  total?: number
  /** Human-readable status line */
  detail?: string
}

export interface AgentResultEvent {
  /** Phase that completed */
  phase: string
  /** One-line summary (e.g., '"Dark Kitchen" scored 7.2/10') */
  summary: string
  /** Truncated input preview (first ~300 chars of user prompt) */
  inputPreview?: string
  /** Truncated output preview (first ~500 chars of raw response) */
  outputPreview?: string
  /** Token usage from the API call */
  tokens?: { input: number; output: number }
  /** Model used for this call */
  model?: string
}

export interface AgentPromptEvent {
  /** Phase of work */
  phase: string
  /** System prompt (only sent on first call to avoid repeating 2K+ words) */
  systemPrompt?: string
  /** User prompt sent to the sub-agent */
  userPrompt: string
}

// ─── Interface ──────────────────────────────────────────────────

export interface AgentEmitter {
  /** A phase of work is starting or progressing */
  progress(event: AgentProgressEvent): void

  /** A sub-call completed with parseable results */
  result(event: AgentResultEvent): void

  /** The raw prompt being sent to the sub-agent (for full visibility) */
  prompt?(event: AgentPromptEvent): void
}
