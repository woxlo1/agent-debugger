import { useEffect, useState } from "react"
import type { AgentEvent, TraceSummary } from "./types"
import { fetchTraces, fetchEvents, subscribeToStream } from "./api"
import TraceList from "./components/TraceList"
import ReplayTimeline from "./components/ReplayTimeline"
import DetailPanel from "./components/DetailPanel"

export default function App() {
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  // Poll the trace list every 2s (simple + reliable for an MVP).
  useEffect(() => {
    const load = () => fetchTraces().then(setTraces).catch(() => {})
    load()
    const id = setInterval(load, 2000)
    return () => clearInterval(id)
  }, [])

  // Auto-select the first/most-recent trace once traces load.
  useEffect(() => {
    if (!selectedTraceId && traces.length > 0) {
      setSelectedTraceId(traces[0].traceId)
    }
  }, [traces, selectedTraceId])

  // Load events for the selected trace.
  useEffect(() => {
    if (!selectedTraceId) return
    fetchEvents(selectedTraceId).then((evts) => {
      setEvents(evts)
      setCurrentIndex(evts.length > 0 ? evts.length - 1 : 0)
    })
  }, [selectedTraceId])

  // Live updates via SSE: append new events for the currently selected trace.
  useEffect(() => {
    const unsubscribe = subscribeToStream((event) => {
      if (event.traceId === selectedTraceId) {
        setEvents((prev) => [...prev, event])
      }
    })
    return unsubscribe
  }, [selectedTraceId])

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-5 py-3 flex items-center gap-3">
        <span className="text-emerald-400 font-bold text-lg">●</span>
        <h1 className="font-semibold text-lg">Agent Debugger</h1>
        <span className="text-xs text-zinc-500">Chrome DevTools for LLM agents</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <TraceList
          traces={traces}
          selectedTraceId={selectedTraceId}
          onSelect={setSelectedTraceId}
        />

        <div className="w-[420px] border-r border-zinc-800">
          <ReplayTimeline
            events={events}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
          />
        </div>

        <DetailPanel event={events[currentIndex] ?? null} />
      </div>
    </div>
  )
}
