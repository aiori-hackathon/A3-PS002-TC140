import { useState, useEffect, useCallback } from 'react'
import {
  Database, User, ShieldCheck, ShieldAlert, Download, AlertOctagon,
  Play, CheckCircle2, XCircle, RefreshCw, ArrowRight, Lock, Hash,
  FileCheck, FileX, Terminal, Loader2
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const DEMO_STEPS = [
  { id: 1, label: '1. Grant P1 Consent', detail: 'Alice grants App Usage Telemetry consent against Notice v1 (cv=1)' },
  { id: 2, label: '2. Issue ES256 Assertion Token', detail: 'FitNest signs 5-min JWT asserting Alice consented to P1' },
  { id: 3, label: '3. PartnerHub Legitimate Access', detail: 'Gateway verifies signature + live cv -> Delivers scoped data (200 OK)' },
  { id: 4, label: '4. Withdraw P1 Consent', detail: 'Alice revokes consent -> State transitions to WITHDRAWN (cv increments to 2)' },
  { id: 5, label: '5. Replay Attack Detection', detail: 'Attempt to reuse old token -> Gateway blocks instantly with 403 TOKEN_STALE' },
  { id: 6, label: '6. Publish Material Notice v2', detail: 'Admin publishes Notice v2 with material change to P3 (Clinical Telemetry)' },
  { id: 7, label: '7. Re-Consent to Notice v2', detail: 'Alice reviews changes and grants fresh consent under Notice v2 (cv=1, nv=2)' },
  { id: 8, label: '8. Full Ledger Verification', detail: 'Cryptographic engine validates all SHA-256 block hashes and sequence pointers' },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function AuditLedger() {
  const [selectedUser, setSelectedUser] = useState('alice')
  const [events, setEvents] = useState([])
  const [accessLogs, setAccessLogs] = useState([])
  const [exportData, setExportData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Verification state
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyLoading, setVerifyLoading] = useState(false)

  // Tamper simulation state
  const [tamperSeq, setTamperSeq] = useState(1)
  const [tamperLoading, setTamperLoading] = useState(false)
  const [tamperStatus, setTamperStatus] = useState(null)

  // Demo runner state
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoStep, setDemoStep] = useState(null)
  const [demoResults, setDemoResults] = useState({})
  const [demoComplete, setDemoComplete] = useState(false)

  const loadAuditData = useCallback(async (userId) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/audit/export/${userId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load audit trail`)
      const data = await res.json()
      setExportData(data)
      setEvents(data.events || [])
      setAccessLogs(data.accessLogs || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAuditData(selectedUser)
  }, [selectedUser, loadAuditData])

  const handleVerify = async () => {
    setVerifyLoading(true)
    setVerifyResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/audit/verify/${selectedUser}`)
      const data = await res.json()
      setVerifyResult(data)
    } catch (err) {
      setVerifyResult({ chainValid: false, error: err.message })
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleTamper = async () => {
    setTamperLoading(true)
    setTamperStatus(null)
    try {
      const res = await fetch(`${API_BASE}/api/audit/simulate-tamper/${selectedUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seq: Number(tamperSeq), field: 'action', value: 'TAMPERED_ACTION' }),
      })
      const data = await res.json()
      setTamperStatus(data)
      await loadAuditData(selectedUser)
      // Auto-trigger verification to show it break!
      await handleVerify()
    } catch (err) {
      setTamperStatus({ error: err.message })
    } finally {
      setTamperLoading(false)
    }
  }

  const handleExportJson = () => {
    if (!exportData) return
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consentguard-audit-${selectedUser}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 1-Click Guided Demo Runner
  const runDemo = async () => {
    setDemoRunning(true)
    setDemoComplete(false)
    setDemoResults({})
    setDemoStep(null)
    const demoUser = 'alice'
    setSelectedUser(demoUser)
    let savedToken = null

    try {
      // Step 1: Grant P1
      setDemoStep(1)
      await sleep(600)
      const curNoticeRes = await fetch(`${API_BASE}/api/notices/current`)
      const curNotice = await curNoticeRes.json()
      const g1 = await fetch(`${API_BASE}/api/consent/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: demoUser, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version }),
      })
      const g1Data = await g1.json()
      setDemoResults((p) => ({ ...p, 1: { ok: g1.ok, msg: `Granted P1 (cv=${g1Data.cv}, nv=${g1Data.noticeVersion})` } }))

      // Step 2: Issue Token
      setDemoStep(2)
      await sleep(600)
      const tRes = await fetch(`${API_BASE}/api/assertions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: demoUser, purposeId: 'P1_ANALYTICS' }),
      })
      const tData = await tRes.json()
      savedToken = tData.token
      setDemoResults((p) => ({ ...p, 2: { ok: tRes.ok, msg: `Issued ES256 Token (sub=${tData.claims?.sub}, cv=${tData.claims?.cv})` } }))

      // Step 3: Legitimate PartnerHub Call
      setDemoStep(3)
      await sleep(600)
      const hub1 = await fetch(`${API_BASE}/api/partnerhub/records?userId=${demoUser}&purposeId=P1_ANALYTICS`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
      const hub1Data = await hub1.json()
      setDemoResults((p) => ({ ...p, 3: { ok: hub1.status === 200, msg: `HTTP 200 OK — Scoped data received: [${Object.keys(hub1Data.data || {}).join(', ')}]` } }))

      // Step 4: Withdraw P1
      setDemoStep(4)
      await sleep(600)
      const wRes = await fetch(`${API_BASE}/api/consent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: demoUser, purposeId: 'P1_ANALYTICS' }),
      })
      const wData = await wRes.json()
      setDemoResults((p) => ({ ...p, 4: { ok: wRes.ok, msg: `Withdrawn P1 (Status: WITHDRAWN, live cv=${wData.cv})` } }))

      // Step 5: Replay Old Token (Expect 403)
      setDemoStep(5)
      await sleep(600)
      const hub2 = await fetch(`${API_BASE}/api/partnerhub/records?userId=${demoUser}&purposeId=P1_ANALYTICS`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
      const hub2Data = await hub2.json()
      const blocked = hub2.status === 403
      setDemoResults((p) => ({ ...p, 5: { ok: blocked, msg: `HTTP 403 ${hub2Data.reason || hub2Data.reasonCode} — Replay blocked instantly via live CV check!` } }))

      // Step 6: Publish Material Notice v2
      setDemoStep(6)
      await sleep(600)
      const pRes = await fetch(`${API_BASE}/api/notices/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: 'MATERIAL',
          affectedPurposes: ['P3_RESEARCH_SHARING'],
        }),
      })
      const pData = await pRes.json()
      setDemoResults((p) => ({ ...p, 6: { ok: pRes.ok, msg: `Published Notice v${pData.version} (MATERIAL: P3 flagged outdated)` } }))

      // Step 7: Grant P3 Re-Consent
      setDemoStep(7)
      await sleep(600)
      const g2 = await fetch(`${API_BASE}/api/consent/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: demoUser, purposeId: 'P3_RESEARCH_SHARING', noticeVersion: pData.version }),
      })
      const g2Data = await g2.json()
      setDemoResults((p) => ({ ...p, 7: { ok: g2.ok, msg: `Re-consented P3 against Notice v${g2Data.noticeVersion} (cv=${g2Data.cv})` } }))

      // Step 8: Verify Hash Chain
      setDemoStep(8)
      await sleep(600)
      // Flush queue first
      await fetch(`${API_BASE}/api/audit/flush-queue`, { method: 'POST' })
      const vRes = await fetch(`${API_BASE}/api/audit/verify/${demoUser}`)
      const vData = await vRes.json()
      setDemoResults((p) => ({ ...p, 8: { ok: vData.chainValid, msg: `Chain Verified: ${vData.totalEvents} events checked, 0 broken links.` } }))

      setDemoComplete(true)
      await loadAuditData(demoUser)
    } catch (err) {
      console.error('Demo error:', err)
    } finally {
      setDemoRunning(false)
      setDemoStep(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="p-4 rounded-xl bg-[#141518] border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Subject switcher */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Subject:</span>
          <div className="inline-flex p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            {['alice', 'bob'].map((u) => (
              <button
                key={u}
                onClick={() => { setSelectedUser(u); setVerifyResult(null); setTamperStatus(null) }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all ${
                  selectedUser === u
                    ? 'bg-zinc-800 text-white border border-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{u}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Global Auditor Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleVerify}
            disabled={verifyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-900/50 hover:border-emerald-600/70 text-emerald-400 text-xs font-mono font-medium transition-all"
          >
            {verifyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>Verify Chain Integrity</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={!exportData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Evidence JSON</span>
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verifyResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 font-mono text-xs ${
            verifyResult.chainValid
              ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
          }`}
        >
          {verifyResult.chainValid ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <span>{verifyResult.chainValid ? '✓ LEDGER INTEGRITY CONFIRMED' : '✗ TAMPERING DETECTED: HASH CHAIN BROKEN'}</span>
            </div>
            <p className="text-[11px] opacity-90">
              {verifyResult.chainValid
                ? `Successfully recalculated SHA-256 digests across all ${verifyResult.totalEvents} sequential events for ${selectedUser}. All prevHash pointers match.`
                : `Integrity failure at Sequence #${verifyResult.firstBrokenSeq}! Computed SHA-256 payload digest deviates from stored block hash.`}
            </p>
          </div>
          <button
            onClick={() => setVerifyResult(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1-Click Guided Demo Runner (Stepped Test Flight) */}
      <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
                1-Click Guided Demo Runner (A3-PS002-TC140 Verification Flight)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Automates the full 8-step lifecycle: Grant → Scoped Data → Revoke → Replay Block → Material Notice → Re-Consent → Hash Verification.
            </p>
          </div>

          <button
            onClick={runDemo}
            disabled={demoRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
          >
            {demoRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing Step {demoStep}/8...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>▶ Run Full Demo Flight</span>
              </>
            )}
          </button>
        </div>

        {/* 8-Step Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DEMO_STEPS.map((step) => {
            const isCurrent = demoStep === step.id
            const res = demoResults[step.id]
            const isDone = res !== undefined
            const isSuccess = res?.ok === true
            const isFailed = res?.ok === false

            return (
              <div
                key={step.id}
                className={`p-3 rounded-lg border text-xs font-mono transition-all ${
                  isCurrent
                    ? 'bg-zinc-800 border-emerald-500 ring-1 ring-emerald-500/30'
                    : isSuccess
                    ? 'bg-zinc-900/90 border-emerald-900/50'
                    : isFailed
                    ? 'bg-rose-950/20 border-rose-900/50'
                    : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] uppercase font-bold ${isCurrent ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    Step {step.id}
                  </span>
                  {isCurrent && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                  {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {isFailed && <XCircle className="w-3 h-3 text-rose-400" />}
                </div>

                <div className={`font-semibold ${isCurrent ? 'text-white' : isSuccess ? 'text-zinc-200' : 'text-zinc-400'}`}>
                  {step.label}
                </div>

                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                  {step.detail}
                </p>

                {res && (
                  <div className={`mt-2 p-1.5 rounded text-[10px] break-words ${isSuccess ? 'bg-emerald-950/40 text-emerald-300' : 'bg-rose-950/40 text-rose-300'}`}>
                    {res.msg}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Hash-Chained Event Ledger Table & Tamper Simulation Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Event Chain List (8 cols) */}
        <div className="lg:col-span-8 p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                Immutable Event Ledger ({events.length} Blocks Recorded)
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Hash: SHA-256(prevHash + payload) with strict monotonic sequence numbers
              </p>
            </div>
            <button
              onClick={() => loadAuditData(selectedUser)}
              disabled={loading}
              className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 font-mono text-xs">
              No consent events recorded for {selectedUser} yet. Grant or withdraw consent to generate chained ledger blocks.
            </div>
          ) : (
            <div className="space-y-2.5 font-mono text-xs">
              {events.map((ev, idx) => (
                <div
                  key={ev.seq}
                  className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-2"
                >
                  {/* Top line: Seq, Action, Purpose, Versions */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[11px]">
                        Seq #{ev.seq}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          ev.action === 'GRANT'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {ev.action}
                      </span>
                      <span className="text-zinc-300 font-semibold text-xs">{ev.purposeId}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span>cv.{ev.cv}</span>
                      <span>·</span>
                      <span>nv.{ev.noticeVersion}</span>
                      <span>·</span>
                      <span className="text-zinc-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Hash linkage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-zinc-900">
                      <span className="text-[10px] text-zinc-500 block">Previous Hash (Pointer):</span>
                      <span className="text-zinc-400 truncate block select-all" title={ev.prevHash}>
                        {ev.prevHash === 'GENESIS' ? 'GENESIS' : `${ev.prevHash.slice(0, 18)}…`}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-black/40 border border-zinc-900">
                      <span className="text-[10px] text-zinc-500 block">Block SHA-256 Digest:</span>
                      <span className="text-cyan-400 font-bold truncate block select-all" title={ev.hash}>
                        {ev.hash.slice(0, 18)}…
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tamper Simulation Console (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
                DB Tamper Simulation
              </h3>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Demonstrates cryptographic non-repudiation. Directly mutates an existing document in MongoDB, bypassing application hooks. Re-running the hash verifier will immediately flag the broken link.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                Target Sequence Number:
              </label>
              <input
                type="number"
                min="1"
                max={events.length || 1}
                value={tamperSeq}
                onChange={(e) => setTamperSeq(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <button
              onClick={handleTamper}
              disabled={tamperLoading || events.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/60 text-amber-300 text-xs font-mono font-semibold transition-all disabled:opacity-40"
            >
              {tamperLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertOctagon className="w-3.5 h-3.5" />
              )}
              <span>Inject Corruption at Seq #{tamperSeq}</span>
            </button>

            {tamperStatus && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                {tamperStatus.error ? (
                  <span className="text-rose-400">Error: {tamperStatus.error}</span>
                ) : (
                  <span className="text-amber-300">
                    Mutated Seq #{tamperStatus.seq} in MongoDB. Hash chain integrity will now fail on next verification!
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Access Logs Snapshot */}
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                Async Access Logs
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {accessLogs.length} Entries
              </span>
            </div>

            {accessLogs.length === 0 ? (
              <p className="text-[11px] font-mono text-zinc-600 py-3 text-center">
                No access attempts logged yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                {accessLogs.slice(-6).reverse().map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-zinc-900/50 border border-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          log.decision === 'ALLOWED' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span className={log.decision === 'ALLOWED' ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.decision}
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{log.reasonCode}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
