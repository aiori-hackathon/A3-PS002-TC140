import { useState, useEffect, useCallback } from 'react'
import {
  Shield, CheckCircle2, XCircle, AlertCircle, RefreshCw, User,
  Activity, Sparkles, HeartPulse, ArrowRight, ShieldAlert, Check
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const PURPOSE_SPECS = {
  P1_ANALYTICS: {
    code: 'P1',
    title: 'App Telemetry & Usage Events',
    icon: Activity,
    category: 'System Diagnostics & Optimization',
    description: 'Collection of diagnostic app usage events and workout session counters to enhance system performance and reliability.',
    categories: ['appUsageEvents', 'sessionCount'],
  },
  P2_PERSONALISATION: {
    code: 'P2',
    title: 'Behavioral Activity Personalisation',
    icon: Sparkles,
    category: 'Recommendation Engine',
    description: 'Analysis of exercise intensity and training preferences to dynamically tailor workout suggestions and dietary tips.',
    categories: ['activitySummary', 'preferences'],
  },
  P3_RESEARCH_SHARING: {
    code: 'P3',
    title: 'Pseudonymised Clinical Telemetry',
    icon: HeartPulse,
    category: 'Third-Party Health Research',
    description: 'Encrypted transfer of pseudonymised heart-rate time series and sleep metrics to certified medical research partners.',
    categories: ['pseudonymisedHeartRate', 'sleepHours'],
  },
}

export default function ConsentPortal() {
  const [selectedUser, setSelectedUser] = useState('alice')
  const [consentData, setConsentData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null) // purposeId currently processing
  const [feedback, setFeedback] = useState(null)

  const fetchConsent = useCallback(async (userId) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/consent/${userId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load consent records`)
      const data = await res.json()
      setConsentData(data)
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConsent(selectedUser)
  }, [selectedUser, fetchConsent])

  const handleGrant = async (purposeId) => {
    const noticeVersion = consentData?.currentNotice?.version || consentData?.notice?.version || 1
    setActionLoading(purposeId)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE}/api/consent/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser, purposeId, noticeVersion }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.message || body.error || `Grant failed with status ${res.status}`)
      }
      setFeedback({
        type: 'success',
        message: `Consent granted for ${purposeId}. State committed with cv=${body.cv}, nv=${body.noticeVersion}. Hash-chained to immutable ledger.`,
      })
      await fetchConsent(selectedUser)
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  const handleWithdraw = async (purposeId) => {
    setActionLoading(purposeId)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE}/api/consent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser, purposeId }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.message || body.error || `Withdrawal failed with status ${res.status}`)
      }
      setFeedback({
        type: 'success',
        message: `Consent withdrawn for ${purposeId}. State transitioned to WITHDRAWN (cv=${body.cv}). Live cache invalidated instantly.`,
      })
      await fetchConsent(selectedUser)
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  const activeNotice = consentData?.currentNotice || consentData?.notice
  const purposesMap = consentData?.purposes || {}
  const outdatedMap = consentData?.needsReConsent || consentData?.outdatedFlags || {}

  const grantedCount = Object.values(purposesMap).filter((p) => p.status === 'GRANTED').length
  const outdatedCount = Object.values(outdatedMap).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Top Controls: Identity Switcher & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#141518] border border-zinc-800">
        {/* User Identity Switcher */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Subject:</span>
          <div className="inline-flex p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            {[
              { id: 'alice', name: 'Alice (Data Principal)', tag: 'Primary' },
              { id: 'bob', name: 'Bob (Data Principal)', tag: 'Secondary' },
            ].map((u) => {
              const active = selectedUser === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    active
                      ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/80'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <User className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span>{u.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Global Overview Metrics */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Notice Version:</span>
            <span className="text-emerald-400 font-bold">v{activeNotice?.version || 1}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-500">Active Grants:</span>
            <span className="text-zinc-200 font-bold">{grantedCount}/3</span>
          </div>
          <button
            onClick={() => fetchConsent(selectedUser)}
            disabled={loading}
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors disabled:opacity-50"
            title="Refresh Consent State"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-lg border text-xs font-mono ${
            feedback.type === 'error'
              ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
          }`}
        >
          {feedback.type === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p>{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notice Outdated Notification Bar */}
      {outdatedCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-300">
              Material Privacy Notice Amendment Detected (Notice v{activeNotice?.version})
            </p>
            <p className="text-amber-300/80 mt-0.5">
              FitNest has published a material modification affecting {outdatedCount} purpose(s). Existing consents for affected purposes have been flagged as outdated. PartnerHub access on these purposes will be blocked with <code className="font-mono text-amber-200 bg-amber-950/60 px-1 py-0.5 rounded">403 NOTICE_OUTDATED</code> until you review and grant fresh consent.
            </p>
          </div>
        </div>
      )}

      {/* 3 Discrete Purpose Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Object.entries(PURPOSE_SPECS).map(([purposeId, spec]) => {
          const state = purposesMap[purposeId]
          const status = state?.status || 'NONE'
          const isOutdated = Boolean(outdatedMap[purposeId])
          const cv = state?.cv ?? 0
          const nv = state?.noticeVersion ?? '—'
          const isProcessing = actionLoading === purposeId
          const Icon = spec.icon

          const isGranted = status === 'GRANTED'
          const isWithdrawn = status === 'WITHDRAWN'

          return (
            <div
              key={purposeId}
              className={`flex flex-col justify-between rounded-xl bg-[#141518] border transition-all duration-200 ${
                isOutdated
                  ? 'border-amber-700/60 ring-1 ring-amber-600/30'
                  : isGranted
                  ? 'border-emerald-800/50'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header: Code & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                      <Icon className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-400">{spec.code}</span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{spec.category}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-0.5">{spec.title}</h3>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isGranted && !isOutdated && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        GRANTED
                      </span>
                    )}
                    {isGranted && isOutdated && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        OUTDATED
                      </span>
                    )}
                    {isWithdrawn && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-950/60 text-rose-400 border border-rose-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        WITHDRAWN
                      </span>
                    )}
                    {status === 'NONE' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        UNSET
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[48px]">
                  {spec.description}
                </p>

                {/* Outdated Re-consent Callout */}
                {isOutdated && (
                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px] font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Notice v{activeNotice?.version} Re-Consent Mandated
                    </div>
                    <p className="text-[11px] text-amber-200/80">
                      Material change to telemetry categories. Prior consent against Notice v{nv} is now void.
                    </p>
                  </div>
                )}

                {/* Permitted Categories */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Scoped Data Categories:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ledger & Telemetry Counters */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                  <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 font-mono">
                    <span className="text-[10px] text-zinc-500 uppercase block">Consent Version</span>
                    <span className="text-xs font-semibold text-zinc-200">cv.{cv}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 font-mono">
                    <span className="text-[10px] text-zinc-500 uppercase block">Notice Ref</span>
                    <span className="text-xs font-semibold text-zinc-200">{nv !== '—' ? `nv.${nv}` : 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-zinc-900/40 border-t border-zinc-800/80 flex items-center gap-2">
                <button
                  onClick={() => handleGrant(purposeId)}
                  disabled={isProcessing || (isGranted && !isOutdated)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    isOutdated
                      ? 'bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm'
                      : isGranted
                      ? 'bg-zinc-800/40 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isOutdated ? 'Grant v2 Re-Consent' : 'Grant Consent'}</span>
                </button>

                <button
                  onClick={() => handleWithdraw(purposeId)}
                  disabled={isProcessing || !isGranted}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all bg-zinc-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/50 text-zinc-300 border border-zinc-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Withdraw consent immediately"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Withdraw</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
