import type { TraceSummary } from "../types"

type Props = {
  traces: TraceSummary[]
  selectedTraceId: string | null
  onSelect: (traceId: string) => void
}

export default function TraceList({ traces, selectedTraceId, onSelect }: Props) {
  return (
    <div className="w-64 border-r border-zinc-800 h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Traces
        </h2>
      </div>
      {traces.length === 0 && (
        <p className="px-4 py-6 text-sm text-zinc-500">
          No traces yet. Run an agent with the SDK, or try:
          <br />
          <code className="text-emerald-400">npm run demo</code>
        </p>
      )}
      <ul>
        {traces.map((t) => (
          <li key={t.traceId}>
            <button
              onClick={() => onSelect(t.traceId)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-900 hover:bg-zinc-800 transition-colors ${
                selectedTraceId === t.traceId ? "bg-zinc-800" : ""
              }`}
            >
              <div className="text-sm font-medium truncate">{t.traceId}</div>
              <div className="text-xs text-zinc-500">
                {t.eventCount} events
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
