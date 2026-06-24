import type { AgentEventType } from "../types"

const STYLES: Record<AgentEventType, string> = {
  user: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  reasoning: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  tool: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  agent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
}

export default function TypeBadge({ type }: { type: AgentEventType }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STYLES[type]}`}
    >
      {type}
    </span>
  )
}
