import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { UsageLedger } from "../types"
import { fetchUsage } from "../api"

type Props = {
  traceId: string | null
}

const confidenceClass: Record<string, string> = {
  reported: "bg-emerald-900 text-emerald-300",
  estimated: "bg-amber-900 text-amber-300",
  unknown: "bg-zinc-800 text-zinc-400",
}

function formatTokens(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString()
}

export default function UsagePanel({ traceId }: Props) {
  const [ledger, setLedger] = useState<UsageLedger | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeEstimates, setIncludeEstimates] = useState(false)

  useEffect(() => {
    setLedger(null)
    setError(null)
    if (!traceId) return
    fetchUsage(traceId, includeEstimates)
      .then(setLedger)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [traceId, includeEstimates])

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">AI Usage Ledger</h2>
          <p className="text-xs text-zinc-500">
            Provider-reported values only. Estimates are opt-in and never billed by default.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={includeEstimates}
            onChange={(event) => setIncludeEstimates(event.target.checked)}
            className="accent-emerald-500"
          />
          Include estimates
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-950 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!traceId && (
        <p className="text-sm text-zinc-500">Select a trace to inspect its AI usage.</p>
      )}

      {ledger && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5 text-sm">
            <Metric label="Input" value={formatTokens(ledger.totals.inputTokens)} />
            <Metric label="Output" value={formatTokens(ledger.totals.outputTokens)} />
            <Metric label="Cached" value={formatTokens(ledger.totals.cacheReadTokens)} />
            <Metric label="Total" value={formatTokens(ledger.totals.totalTokens)} />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded ${confidenceClass[ledger.confidence]}`}>
              {ledger.confidence}
            </span>
            <span className="text-zinc-500">{ledger.totals.entries} included entries</span>
            {ledger.estimatedExcludedFromCost && (
              <span className="px-2 py-0.5 rounded bg-amber-900 text-amber-300">
                estimates excluded
              </span>
            )}
          </div>

          {ledger.warnings.length > 0 && (
            <Section title="Warnings">
              <ul className="list-disc list-inside text-sm text-amber-300 space-y-1">
                {ledger.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Usage entries">
            {ledger.entries.length === 0 ? (
              <Empty>No usage entries recorded for this trace.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-800">
                      <th className="py-2">Source</th>
                      <th className="py-2">Model</th>
                      <th className="py-2">Confidence</th>
                      <th className="py-2">Tokens</th>
                      <th className="py-2">Consent</th>
                      <th className="py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-zinc-900">
                        <td className="py-2 pr-3">{entry.sourceLabel}</td>
                        <td className="py-2 pr-3 text-zinc-400">{entry.model ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${confidenceClass[entry.confidence]}`}>
                            {entry.confidence}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{formatTokens(entry.totalTokens)}</td>
                        <td className="py-2 pr-3 text-zinc-400">{entry.consent}</td>
                        <td className="py-2 pr-3">
                          {entry.cost === undefined ? "—" : `$${entry.cost.toFixed(4)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded bg-zinc-900 border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>
}
