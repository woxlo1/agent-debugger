import { useEffect, useState } from "react"
import type { AgentEvent } from "../types"
import TypeBadge from "./TypeBadge"

type Props = {
  events: AgentEvent[]
  currentIndex: number
  onIndexChange: (index: number) => void
}

export default function ReplayTimeline({
  events,
  currentIndex,
  onIndexChange,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false)

  // Drives playback: advance one step at a fixed interval until the end.
  useEffect(() => {
    if (!isPlaying) return
    if (currentIndex >= events.length - 1) {
      setIsPlaying(false)
      return
    }
    const id = setTimeout(() => {
      onIndexChange(currentIndex + 1)
    }, 800)
    return () => clearTimeout(id)
  }, [isPlaying, currentIndex, events.length, onIndexChange])

  const stepBack = () => onIndexChange(Math.max(0, currentIndex - 1))
  const stepForward = () =>
    onIndexChange(Math.min(events.length - 1, currentIndex + 1))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={stepBack}
          disabled={currentIndex <= 0}
          className="px-3 py-1.5 text-sm rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
        >
          ⏮ Step
        </button>
        <button
          onClick={() => setIsPlaying((p) => !p)}
          disabled={events.length === 0}
          className="px-4 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 font-medium"
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={stepForward}
          disabled={currentIndex >= events.length - 1}
          className="px-3 py-1.5 text-sm rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
        >
          Step ⏭
        </button>
        <span className="ml-auto text-xs text-zinc-500">
          {events.length > 0 ? `${currentIndex + 1} / ${events.length}` : "0 / 0"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.map((event, i) => (
          <button
            key={event.id}
            onClick={() => onIndexChange(i)}
            className={`w-full text-left px-4 py-3 border-b border-zinc-900 transition-colors flex items-start gap-3 ${
              i === currentIndex
                ? "bg-zinc-800 border-l-2 border-l-emerald-500"
                : i < currentIndex
                ? "opacity-50 hover:opacity-80"
                : "opacity-30 hover:opacity-60"
            }`}
          >
            <span className="text-xs text-zinc-500 w-6 pt-0.5">{i + 1}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TypeBadge type={event.type} />
                <span className="text-sm font-medium">{event.name}</span>
              </div>
              <div className="text-xs text-zinc-500 truncate max-w-md">
                {typeof event.output === "string"
                  ? event.output
                  : typeof event.input === "string"
                  ? event.input
                  : JSON.stringify(event.output ?? event.input ?? "")}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
