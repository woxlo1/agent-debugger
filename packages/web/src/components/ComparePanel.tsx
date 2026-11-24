import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { CaseSummary, CaseComparison, NumericDiff, TraceSummary } from "../types"
import { fetchCaseComparison, packageUrl } from "../api"

type Props = {
  traces: TraceSummary[]
  selectedTraceId: string | null
}

export default function ComparePanel({ traces, selectedTraceId }: Props) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [includeEstimates, setIncludeEstimates] = useState(false)
  const [comparison, setComparison] = useState<CaseComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedTraceId) setA(selectedTraceId)
    else if (!a && traces.length > 0) setA(traces[0].traceId)
  }, [selectedTraceId, traces, a])

  useEffect(() => {
    if (b && b !== a) return
    const candidate = traces.find((trace) => trace.traceId !== a)?.traceId ?? ""
    if (candidate && candidate !== b) setB(candidate)
  }, [traces, a, b])

  useEffect(() => {
    setComparison(null)
    setError(null)
    if (!a || !b || a === b) return
    setLoading(true)
    fetchCaseComparison(a, b, includeEstimates)
      .then(setComparison)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setLoading(false))
  }, [a, b, includeEstimates])

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Case Compare</h2>
        <p className="text-xs text-zinc-500">
          Diff two local traces: evidence, hypotheses, usage, and privacy signals.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label className="block">
          <span className="block text-xs uppercase text-zinc-500 mb-1">Case A</span>
          <select
            value={a}
            onChange={(event) => setA(event.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm"
          >
            <option value="">Select a trace</option>
            {traces.map((trace) => (
              <option key={trace.traceId} value={trace.traceId}>
                {trace.traceId}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-zinc-500 mb-1">Case B</span>
          <select
            value={b}
            onChange={(event) => setB(event.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm"
          >
            <option value="">Select a trace</option>
            {traces.map((trace) => (
              <option key={trace.traceId} value={trace.traceId}>
                {trace.traceId}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={includeEstimates}
            onChange={(event) => setIncludeEstimates(event.target.checked)}
            className="accent-emerald-500"
          />
          Estimates
        </label>
      </div>

      {a && (
        <div className="mb-4">
          <a
            href={packageUrl(a, includeEstimates)}
            className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800"
          >
            Export package for A
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-950 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-500">Comparing cases…</p>}

      {!loading && !comparison && a && b && a === b && (
        <p className="text-sm text-zinc-500">Select two different traces to compare.</p>
      )}

      {comparison && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <CaseCard label="A" summary={comparison.a} />
            <CaseCard label="B" summary={comparison.b} />
          </div>

          <Section title="Key differences">
            <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
              {comparison.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Section>

          <Section title="Trace metrics">
            <DiffTable diffs={comparison.metrics} />
          </Section>

          <Section title="Cause hypotheses">
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in A</p>
                {comparison.candidates.onlyA.length === 0 ? (
                  <Empty>None</Empty>
                ) : (
                  comparison.candidates.onlyA.map((item) => (
                    <p key={item.id} className="text-zinc-300">
                      {item.label} ({item.confidence})
                    </p>
                  ))
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in B</p>
                {comparison.candidates.onlyB.length === 0 ? (
                  <Empty>None</Empty>
                ) : (
                  comparison.candidates.onlyB.map((item) => (
                    <p key={item.id} className="text-zinc-300">
                      {item.label} ({item.confidence})
                    </p>
                  ))
                )}
              </div>
            </div>
            {comparison.candidates.shared
              .filter((item) => item.state === "changed")
              .map((item) => (
                <p key={item.id} className="text-sm text-amber-300">
                  {item.id} changed: {item.changedFields.join(", ")}
                </p>
              ))}
          </Section>

          <Section title="Observed evidence">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in A</p>
                {comparison.evidence.onlyA.map((item) => (
                  <p key={item.id} className="text-zinc-300">
                    {item.label}
                  </p>
                ))}
                {comparison.evidence.onlyA.length === 0 && <Empty>None</Empty>}
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in B</p>
                {comparison.evidence.onlyB.map((item) => (
                  <p key={item.id} className="text-zinc-300">
                    {item.label}
                  </p>
                ))}
                {comparison.evidence.onlyB.length === 0 && <Empty>None</Empty>}
              </div>
            </div>
          </Section>

          <Section title="Usage totals">
            <DiffTable diffs={comparison.usage.totals} />
            {comparison.usage.confidence.changed && (
              <p className="text-xs text-amber-300 mt-2">
                Confidence: {comparison.usage.confidence.a} → {comparison.usage.confidence.b}
              </p>
            )}
          </Section>

          <Section title="Privacy signals">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Redaction receipts</p>
                <DiffTable diffs={comparison.privacy.fields} />
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Findings</p>
                <DiffTable diffs={comparison.privacy.findings} />
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-2">
              rawValuesStored: {String(comparison.privacy.rawValuesStored)}
            </p>
          </Section>

          <Section title="Unknowns">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in A</p>
                {comparison.unknowns.onlyA.map((item) => (
                  <p key={item} className="text-zinc-300">
                    {item}
                  </p>
                ))}
                {comparison.unknowns.onlyA.length === 0 && <Empty>None</Empty>}
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500 mb-1">Only in B</p>
                {comparison.unknowns.onlyB.map((item) => (
                  <p key={item} className="text-zinc-300">
                    {item}
                  </p>
                ))}
                {comparison.unknowns.onlyB.length === 0 && <Empty>None</Empty>}
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

function CaseCard({ label, summary }: { label: string; summary: CaseSummary }) {
  return (
    <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
      <p className="text-xs uppercase text-zinc-500">Case {label}</p>
      <p className="text-sm font-medium truncate">{summary.traceId}</p>
      <p className="text-xs text-zinc-500 mt-1">
        {summary.eventCount} events · usage {summary.confidence}
      </p>
      <p className="text-[10px] text-zinc-600 font-mono truncate">
        {summary.fingerprint.slice(0, 16)}
      </p>
    </div>
  )
}

function DiffTable({ diffs }: { diffs: NumericDiff[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-800">
            <th className="py-1.5">Metric</th>
            <th className="py-1.5">A</th>
            <th className="py-1.5">B</th>
            <th className="py-1.5">Δ</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={diff.key} className="border-b border-zinc-900">
              <td className="py-1.5 pr-3">{diff.key}</td>
              <td className="py-1.5 pr-3">{formatValue(diff.key, diff.a)}</td>
              <td className="py-1.5 pr-3">{formatValue(diff.key, diff.b)}</td>
              <td className={`py-1.5 ${diff.changed ? "text-amber-300" : "text-zinc-600"}`}>
                {diff.delta > 0 ? "+" : ""}
                {formatValue(diff.key, diff.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatValue(key: string, value: number): string {
  return key === "cost" ? `$${value.toFixed(4)}` : String(value)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h3>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-zinc-600">{children}</span>
}
