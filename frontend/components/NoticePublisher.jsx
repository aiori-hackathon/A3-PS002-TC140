import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Bell, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw,
  Sliders, ShieldAlert, Sparkles, Check, Info
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const ALL_PURPOSES = [
  { id: 'P1_ANALYTICS', label: 'P1 · App Telemetry', categories: 'appUsageEvents, sessionCount' },
  { id: 'P2_PERSONALISATION', label: 'P2 · Behavioral Preferences', categories: 'activitySummary, preferences' },
  { id: 'P3_RESEARCH_SHARING', label: 'P3 · Pseudonymised Health Telemetry', categories: 'pseudonymisedHeartRate, sleepHours' },
]

export default function NoticePublisher() {
  const [changeType, setChangeType] = useState('MATERIAL')
  const [affectedPurposes, setAffectedPurposes] = useState(['P3_RESEARCH_SHARING'])
  const [currentNotice, setCurrentNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const fetchNotice = useCallback(async () => {
    setFetchLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/notices/current`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch notice`)
      const data = await res.json()
      setCurrentNotice(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setFetchLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotice()
  }, [fetchNotice])

  const togglePurpose = (pid) => {
    setAffectedPurposes((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    )
  }

  const handlePublish = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        changeType,
        affectedPurposes: changeType === 'MATERIAL' ? affectedPurposes : [],
      }

      const res = await fetch(`${API_BASE}/api/notices/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || `Publish failed with status ${res.status}`)
      }
      setResult(body)
      await fetchNotice()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isMaterial = changeType === 'MATERIAL'
  const nextVersion = currentNotice ? currentNotice.version + 1 : 1

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-[#141518] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Notice Governance &amp; Regulatory Versioning Studio
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Admin tool to publish versioned privacy notices and manage compliance triggers across downstream data consumers.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>Fiduciary Policy Engine: FitNest</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Active Notice Specification */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-300">
                Current Active Notice
              </span>
              <button
                onClick={fetchNotice}
                disabled={fetchLoading}
                className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {currentNotice ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-zinc-500">Live Version:</span>
                  <span className="text-emerald-400 font-bold text-sm">v{currentNotice.version}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <span className="text-zinc-500">Publication Type:</span>
                  <span
                    className={`font-semibold ${
                      currentNotice.changeType === 'MATERIAL'
                        ? 'text-amber-400'
                        : currentNotice.changeType === 'INITIAL'
                        ? 'text-blue-400'
                        : 'text-zinc-300'
                    }`}
                  >
                    {currentNotice.changeType}
                  </span>
                </div>

                {currentNotice.affectedPurposes && currentNotice.affectedPurposes.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                    <span className="text-amber-400 text-[11px] block font-semibold mb-1">
                      Materially Affected Purposes:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {currentNotice.affectedPurposes.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[10px] border border-amber-800/60">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5 text-[11px]">
                  <span className="text-zinc-500 block uppercase tracking-wider text-[10px]">Active Purpose Manifest</span>
                  {Object.entries(currentNotice.purposes || {}).map(([pid, p]) => (
                    <div key={pid} className="flex justify-between text-zinc-400">
                      <span>{pid}:</span>
                      <span className="text-zinc-200">
                        {p.materialChangeFromPrev ? '⚠️ Material Change' : 'Unchanged'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs font-mono">
                Loading notice manifest...
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Publication Studio */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-300">
                Publish New Privacy Notice (v{nextVersion})
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-400">
                Target: v{nextVersion}
              </span>
            </div>

            {/* Change Type Radio Options */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                Regulatory Change Classification
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChangeType('MATERIAL')}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    isMaterial
                      ? 'bg-amber-950/20 border-amber-600 text-amber-200'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>MATERIAL CHANGE</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Expands data categories or sharing scope. Automatically marks affected purposes as <strong className="text-amber-300 font-mono">NOTICE_OUTDATED</strong>.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setChangeType('TYPO_NON_MATERIAL')}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    !isMaterial
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>TYPO / NON-MATERIAL</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Minor text edits or legal clarifications. Existing user consents and tokens remain fully valid (<strong className="text-emerald-400 font-mono">200 OK</strong>).
                  </p>
                </button>
              </div>
            </div>

            {/* Affected Purposes Selector (If Material) */}
            {isMaterial && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                    Select Materially Affected Purpose(s):
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {affectedPurposes.length} selected
                  </span>
                </div>

                <div className="space-y-2">
                  {ALL_PURPOSES.map((p) => {
                    const isChecked = affectedPurposes.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        onClick={() => togglePurpose(p.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-amber-950/20 border-amber-700/60 text-zinc-200'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                            isChecked
                              ? 'bg-amber-600 border-amber-500 text-white'
                              : 'border-zinc-700 bg-zinc-900'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-zinc-200">{p.label}</span>
                            <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{p.categories}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Publication Trigger Button */}
            <div className="pt-2">
              <button
                onClick={handlePublish}
                disabled={loading || (isMaterial && affectedPurposes.length === 0)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono uppercase tracking-wider font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                <span>Publish Notice v{nextVersion} to Gateway</span>
              </button>
            </div>

            {/* Error or Success Feedback */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-mono">
                Error: {error}
              </div>
            )}

            {result && (
              <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-emerald-300 text-xs font-mono space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Notice v{result.version} Published Successfully</span>
                </div>
                <p className="text-[11px] text-emerald-300/80">
                  Gateway policy updated. Change type: {result.changeType}. Affected purposes: [{result.affectedPurposes?.join(', ') || 'none'}].
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
