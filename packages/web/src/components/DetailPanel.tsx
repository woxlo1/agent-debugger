import type { AgentEvent } from "../types"
import TypeBadge from "./TypeBadge"

export default function DetailPanel({ event }: { event: AgentEvent | null }) {
  if (!event) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select a step to inspect its details
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <TypeBadge type={event.type} />
        <h3 className="text-lg font-semibold">{event.name}</h3>
      </div>

      <dl className="grid grid-cols-2 gap-3 mb-6 text-sm">
        <Field label="Trace ID" value={event.traceId} />
        <Field label="Event ID" value={event.id} />
        <Field label="Timestamp" value={new Date(event.timestamp).toLocaleTimeString()} />
        <Field label="Tokens" value={event.tokens?.toString() ?? "—"} />
        <Field label="Cost" value={event.cost ? `$${event.cost.toFixed(4)}` : "—"} />
      </dl>

      {event.input !== undefined && (
        <JsonBlock title="Input" data={event.input} />
      )}
      {event.output !== undefined && (
        <JsonBlock title="Output" data={event.output} />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-zinc-200 truncate">{value}</dd>
    </div>
  )
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  const formatted =
    typeof data === "string" ? data : JSON.stringify(data, null, 2)
  return (
    <div className="mb-4">
      <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
        {title}
      </h4>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm overflow-x-auto whitespace-pre-wrap">
        {formatted}
      </pre>
    </div>
  )
}
