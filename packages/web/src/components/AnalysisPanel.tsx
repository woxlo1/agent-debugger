import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { Analysis } from "../types"
import { exportUrl, fetchAnalysis, importTrace, packageUrl } from "../api"

type Props = {
  traceId: string | null
  onImported: (traceId: string) => void
}

const confidenceClass: Record<string, string> = {
  high: "bg-emerald-900 text-emerald-300",
  medium: "bg-amber-900 text-amber-300",
  low: "bg-zinc-800 text-zinc-400",
}

export default function AnalysisPanel({ traceId, onImported }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState("")

  useEffect(() => {
    setAnalysis(null)
    setError(null)
    if (!traceId) return
    fetchAnalysis(traceId)
      .then(setAnalysis)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [traceId])

  async function handleImport() {
    setError(null)
    try {
      const result = await importTrace(input)
      setInput("")
      onImported(result.traceId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Cause Package</h2>
          <p className="text-xs text-zinc-500">
            Rule-based evidence only — no AI service is called.
          </p>
        </div>
        {traceId && (
          <div className="flex gap-2">
            <a
              href={packageUrl(traceId)}
              className="text-xs px-3 py-1.5 rounded border border-emerald-800 text-emerald-300 hover:bg-emerald-950"
            >
              Export package
            </a>
            <a
              href={exportUrl(traceId)}
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800"
            >
              Export NDJSON
            </a>
          </div>
        )}
      </div>

      <section className="mb-5 p-3 border border-zinc-800 rounded-lg">
        <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
          Import a failed trace
        </h3>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste NDJSON events or a JSON array..."
          className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono"
        />
        <button
          onClick={handleImport}
          disabled={!input.trim()}
          className="mt-2 px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30"
        >
          Import & select
        </button>
      </section>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-950 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!traceId && (
        <p className="text-sm text-zinc-500">
          Select a trace or import one to build a Cause Package.
        </p>
      )}

      {analysis && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6 text-sm">
            <Metric label="Events" value={analysis.metrics.eventCount} />
            <Metric label="Tool calls" value={analysis.metrics.toolCalls} />
            <Metric label="Error signals" value={analysis.metrics.errorEvents} />
          </div>

          <Section title="Observed evidence">
            {analysis.observed.length === 0 ? (
              <Empty>No rule-based evidence found.</Empty>
            ) : (
              analysis.observed.map((item) => (
                <div key={item.id} className="mb-3 p-3 rounded bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {item.kind}
                    </span>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{item.detail}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    events: {item.eventIds.join(", ")}
                  </p>
                </div>
              ))
            )}
          </Section>

          <Section title="Cause candidates (hypotheses)">
            {analysis.candidates.map((candidate) => (
              <div key={candidate.id} className="mb-3 p-3 rounded bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                      confidenceClass[candidate.confidence] ?? confidenceClass.low
                    }`}
                  >
                    {candidate.confidence}
                  </span>
                  <span className="font-medium text-sm">{candidate.label}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  evidence: {candidate.evidenceIds.join(", ") || "none"}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Falsifier: {candidate.falsifier}
                </p>
              </div>
            ))}
          </Section>

          <Section title="Reproduction steps">
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
              {analysis.reproduction.map((step) => (
                <li key={step.step}>{step.instruction}</li>
              ))}
            </ol>
          </Section>

          <Section title="Next debugger action">
            {analysis.handoff.map((step, index) => (
              <div key={`${step.tool}-${index}`} className="mb-3">
                <p className="text-xs uppercase text-zinc-500">{step.tool}</p>
                <code className="block bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-emerald-300 overflow-x-auto">
                  {step.command}
                </code>
                <p className="text-xs text-zinc-500 mt-1">{step.note}</p>
              </div>
            ))}
          </Section>

          <Section title="Unknowns">
            <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
              {analysis.unknowns.length === 0 ? (
                <li>None recorded.</li>
              ) : (
                analysis.unknowns.map((item) => <li key={item}>{item}</li>)
              )}
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h3>
      {children}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>
}
