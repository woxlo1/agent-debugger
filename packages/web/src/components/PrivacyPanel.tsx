import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { PrivacyAudit } from "../types"
import { fetchPrivacy } from "../api"

type Props = {
  traceId: string | null
}

export default function PrivacyPanel({ traceId }: Props) {
  const [audit, setAudit] = useState<PrivacyAudit | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAudit(null)
    setError(null)
    if (!traceId) return
    fetchPrivacy(traceId)
      .then(setAudit)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [traceId])

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Privacy Audit</h2>
        <p className="text-xs text-zinc-500">
          Counts and placeholders only. No raw prompt, secret, or personal value is stored.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-950 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!traceId && (
        <p className="text-sm text-zinc-500">Select a trace to inspect its privacy audit.</p>
      )}

      {audit && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5 text-sm">
            <Metric label="Entries" value={String(audit.entries)} />
            <Metric label="Receipts" value={String(audit.redactionReceipts)} />
            <Metric label="Findings" value={String(audit.findings.length)} />
            <Metric label="Skipped fields" value={String(audit.skippedFields)} />
          </div>

          <div className="mb-5">
            <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 text-xs">
              rawValuesStored: {String(audit.rawValuesStored)}
            </span>
          </div>

          <Section title="Consent states">
            <div className="grid grid-cols-4 gap-3 text-sm">
              {Object.entries(audit.consent).map(([key, value]) => (
                <Metric key={key} label={key} value={String(value)} />
              ))}
            </div>
          </Section>

          <Section title="Redaction detectors">
            {audit.findings.length === 0 ? (
              <Empty>No redaction findings recorded.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-800">
                      <th className="py-2">Detector</th>
                      <th className="py-2">Count</th>
                      <th className="py-2">Needs review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.findings.map((finding) => (
                      <tr key={`${finding.detector}-${finding.needsReview}`} className="border-b border-zinc-900">
                        <td className="py-2">{finding.detector}</td>
                        <td className="py-2">{finding.count}</td>
                        <td className="py-2">
                          {finding.needsReview ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-900 text-amber-300 text-[10px]">
                              review
                            </span>
                          ) : (
                            <span className="text-zinc-500">no</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {audit.warnings.length > 0 && (
            <Section title="Warnings">
              <ul className="list-disc list-inside text-sm text-amber-300 space-y-1">
                {audit.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Section>
          )}
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
