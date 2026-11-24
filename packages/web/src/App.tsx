import { useEffect, useState } from "react"
import type { AgentEvent, TraceSummary } from "./types"
import { fetchEvents, fetchTraces, subscribeToStream } from "./api"
import TraceList from "./components/TraceList"
import ReplayTimeline from "./components/ReplayTimeline"
import DetailPanel from "./components/DetailPanel"
import AnalysisPanel from "./components/AnalysisPanel"
import UsagePanel from "./components/UsagePanel"
import PrivacyPanel from "./components/PrivacyPanel"
import ComparePanel from "./components/ComparePanel"

type View = "replay" | "analysis" | "usage" | "privacy" | "compare"

export default function App() {
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [view, setView] = useState<View>("analysis")

  const loadTraces = () => {
    fetchTraces()
      .then(setTraces)
      .catch(() => {})
  }

  useEffect(() => {
    loadTraces()
    const id = setInterval(loadTraces, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selectedTraceId && traces.length > 0) {
      setSelectedTraceId(traces[0].traceId)
    }
  }, [traces, selectedTraceId])

  useEffect(() => {
    if (!selectedTraceId) return
    fetchEvents(selectedTraceId).then((evts) => {
      setEvents(evts)
      setCurrentIndex(evts.length > 0 ? evts.length - 1 : 0)
    })
  }, [selectedTraceId])

  useEffect(() => {
    const unsubscribe = subscribeToStream((event) => {
      if (event.traceId === selectedTraceId) {
        setEvents((prev) => [...prev, event])
      }
    })
    return unsubscribe
  }, [selectedTraceId])

  function handleImported(traceId: string) {
    loadTraces()
    setSelectedTraceId(traceId)
    setView("analysis")
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-5 py-3 flex items-center gap-3">
        <span className="text-emerald-400 font-bold text-lg">●</span>
        <h1 className="font-semibold text-lg">Agent Debugger</h1>
        <span className="text-xs text-zinc-500">
          Failed trace → evidence → debugger handoff
        </span>
        <div className="ml-auto flex gap-1">
          {(["analysis", "compare", "replay", "usage", "privacy"] as View[]).map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={`px-3 py-1.5 text-sm rounded ${
                view === item
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:bg-zinc-900"
              }`}
            >
              {item === "analysis"
                ? "Cause Package"
                : item === "compare"
                  ? "Compare"
                  : item === "replay"
                    ? "Replay"
                    : item === "usage"
                      ? "Usage"
                      : "Privacy"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <TraceList
          traces={traces}
          selectedTraceId={selectedTraceId}
          onSelect={setSelectedTraceId}
        />

        {view === "analysis" ? (
          <AnalysisPanel traceId={selectedTraceId} onImported={handleImported} />
        ) : view === "compare" ? (
          <ComparePanel traces={traces} selectedTraceId={selectedTraceId} />
        ) : view === "usage" ? (
          <UsagePanel traceId={selectedTraceId} />
        ) : view === "privacy" ? (
          <PrivacyPanel traceId={selectedTraceId} />
        ) : (
          <>
            <div className="w-[420px] border-r border-zinc-800">
              <ReplayTimeline
                events={events}
                currentIndex={currentIndex}
                onIndexChange={setCurrentIndex}
              />
            </div>
            <DetailPanel event={events[currentIndex] ?? null} />
          </>
        )}
      </div>
    </div>
  )
}
