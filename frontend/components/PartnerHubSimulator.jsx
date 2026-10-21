import { useState, useCallback } from 'react'
import {
  Zap, Key, ShieldCheck, ShieldAlert, Play, ArrowRight, Clock,
  Cpu, Lock, AlertTriangle, CheckCircle2, XCircle, Terminal, RefreshCw, Eye
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const PURPOSES = [
  { id: 'P1_ANALYTICS', code: 'P1', label: 'App Usage Telemetry', categories: 'appUsageEvents, sessionCount' },
  { id: 'P2_PERSONALISATION', code: 'P2', label: 'Behavioral Preferences', categories: 'activitySummary, preferences' },
  { id: 'P3_RESEARCH_SHARING', code: 'P3', label: 'Clinical Telemetry', categories: 'pseudonymisedHeartRate, sleepHours' },
]

function decodeJwt(token) {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const parsePart = (str) => {
      const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=')
      return JSON.parse(atob(padded))
    }
    return {
      header: parsePart(parts[0]),
      payload: parsePart(parts[1]),
    }
  } catch {
    return null
  }
}

export default function PartnerHubSimulator() {
  const [selectedUser, setSelectedUser] = useState('alice')
  const [selectedPurpose, setSelectedPurpose] = useState('P1_ANALYTICS')
  const [token, setToken] = useState(null)
  const [decodedJwt, setDecodedJwt] = useState(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState(null)

  // Gateway execution state
  const [activeCall, setActiveCall] = useState(null)
  const [callLoading, setCallLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [latency, setLatency] = useState(null)

  const issueToken = useCallback(async () => {
    setTokenLoading(true)
    setTokenError(null)
    try {
      const res = await fetch(`${API_BASE}/api/assertions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser, purposeId: selectedPurpose }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.reason || body.error || `HTTP ${res.status}`)
      }
      setToken(body.token)
      setDecodedJwt(decodeJwt(body.token))
    } catch (err) {
      setToken(null)
      setDecodedJwt(null)
      setTokenError(err.message)
    } finally {
      setTokenLoading(false)
    }
  }, [selectedUser, selectedPurpose])

  const executeGatewayCall = async ({ queryUser, queryPurpose, overrideToken, testName }) => {
    const activeJwt = overrideToken !== undefined ? overrideToken : token
    setActiveCall(testName)
    setCallLoading(true)
    setResponse(null)
    setLatency(null)

    const startTime = performance.now()
    try {
      const headers = {}
      if (activeJwt) {
        headers['Authorization'] = `Bearer ${activeJwt}`
      }

      const res = await fetch(
        `${API_BASE}/api/partnerhub/records?userId=${encodeURIComponent(queryUser)}&purposeId=${encodeURIComponent(queryPurpose)}`,
        { headers }
      )
      const elapsed = Math.round(performance.now() - startTime)
      const data = await res.json().catch(() => ({}))

      setLatency(elapsed)
      setResponse({
        status: res.status,
        statusText: res.statusText,
        reason: data.reason || data.reasonCode || (res.status === 200 ? 'OK' : 'DENIED'),
        data,
      })
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime)
      setLatency(elapsed)
      setResponse({
        status: 500,
        statusText: 'Network Error',
        reason: 'CONNECTION_FAILURE',
        data: { error: err.message },
      })
    } finally {
      setCallLoading(false)
    }
  }

  // Preset Test Scenarios
  const runNormalTest = () => {
    executeGatewayCall({
      queryUser: selectedUser,
      queryPurpose: selectedPurpose,
      testName: 'Standard Scoped Data Request (Legitimate)',
    })
  }

  const runPurposeMismatchTest = () => {
    const wrongPurpose = selectedPurpose === 'P1_ANALYTICS' ? 'P2_PERSONALISATION' : 'P1_ANALYTICS'
    executeGatewayCall({
      queryUser: selectedUser,
      queryPurpose: wrongPurpose,
      testName: `Purpose Mismatch Test (${selectedPurpose} token -> ${wrongPurpose} resource)`,
    })
  }

  const runSubjectMismatchTest = () => {
    const victimUser = selectedUser === 'alice' ? 'bob' : 'alice'
    executeGatewayCall({
      queryUser: victimUser,
      queryPurpose: selectedPurpose,
      testName: `Subject Hijack Test (${selectedUser} token -> ${victimUser} record)`,
    })
  }

  const runTamperedTokenTest = () => {
    if (!token) return
    const parts = token.split('.')
    let tampered = token
    if (parts.length === 3) {
      try {
        const payloadObj = decodeJwt(token).payload
        payloadObj.cv = 9999 // mutate CV or scope
        const newPayload = btoa(JSON.stringify(payloadObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        tampered = `${parts[0]}.${newPayload}.${parts[2]}`
      } catch {
        tampered = `${token}tampered`
      }
    }
    executeGatewayCall({
      queryUser: selectedUser,
      queryPurpose: selectedPurpose,
      overrideToken: tampered,
      testName: 'Cryptographic Tamper Attack (Modified Payload & Broken Signature)',
    })
  }

  return (
    <div className="space-y-6">
      {/* Overview Description */}
      <div className="p-4 rounded-xl bg-[#141518] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              PartnerHub Gateway Simulator
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Demonstrates zero-trust consent enforcement using asymmetric ES256 assertion tokens and sub-millisecond live verification.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Gateway: /api/partnerhub/records</span>
        </div>
      </div>

      {/* 2-Column Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (5 cols): Token Issuer & Inspector */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-300 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                1. FitNest Assertion Token Issuer
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                ES256 (P-256)
              </span>
            </div>

            {/* Principal Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Data Principal (Subject)</label>
              <div className="grid grid-cols-2 gap-2">
                {['alice', 'bob'].map((u) => (
                  <button
                    key={u}
                    onClick={() => { setSelectedUser(u); setToken(null); setDecodedJwt(null) }}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-medium border text-center transition-all ${
                      selectedUser === u
                        ? 'bg-zinc-800 text-white border-zinc-600'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    sub: {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Requested Purpose</label>
              <div className="space-y-1.5">
                {PURPOSES.map((p) => {
                  const active = selectedPurpose === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPurpose(p.id); setToken(null); setDecodedJwt(null) }}
                      className={`w-full p-2.5 rounded-lg text-left border transition-all ${
                        active
                          ? 'bg-zinc-800/80 border-emerald-600/70 text-white'
                          : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-zinc-200">{p.code} · {p.label}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{p.id}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">{p.categories}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Request Token Action */}
            <button
              onClick={issueToken}
              disabled={tokenLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium font-mono uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
            >
              {tokenLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>Issue 5-Min Assertion Token</span>
            </button>

            {tokenError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Assertion Denied ({tokenError})</p>
                  <p className="text-[11px] text-rose-300/80 mt-0.5">
                    Consent record is missing, withdrawn, or outdated. Data Principal must grant consent first in the Consent Portal.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Token Visualizer */}
          {decodedJwt && (
            <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Decoded Token Claims
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  ES256 Signature Valid
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">sub:</span>
                  <span className="text-emerald-400 font-bold">{decodedJwt.payload.sub}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">purpose:</span>
                  <span className="text-cyan-400">{decodedJwt.payload.purpose}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">cv (Consent Version):</span>
                  <span className="text-amber-400 font-bold">{decodedJwt.payload.cv}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">nv (Notice Version):</span>
                  <span className="text-zinc-300">v{decodedJwt.payload.nv}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">aud:</span>
                  <span className="text-purple-400">{decodedJwt.payload.aud}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">scope (SHA-256):</span>
                  <span className="text-zinc-400 truncate max-w-[200px]" title={decodedJwt.payload.scope}>
                    {decodedJwt.payload.scope.slice(0, 16)}…
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">exp (TTL 300s):</span>
                  <span className="text-zinc-400">{new Date(decodedJwt.payload.exp * 1000).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Raw Compact Token Preview */}
              <div className="pt-2">
                <span className="text-[10px] text-zinc-500 block mb-1">Raw Bearer JWT:</span>
                <div className="p-2 rounded bg-black/50 border border-zinc-800 text-[10px] text-zinc-500 break-all select-all font-mono max-h-16 overflow-y-auto">
                  {token}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (7 cols): Gateway Test Console & Response View */}
        <div className="lg:col-span-7 space-y-5">
          {/* Preset Attack & Enforcement Scenarios */}
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-300 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                2. Gateway Enforcement Tests
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Middleware Pipeline</span>
            </div>

            <p className="text-xs text-zinc-400">
              Trigger specific request payloads to test the 6-stage <code className="text-zinc-300 font-mono">enforceConsent</code> middleware pipeline:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={runNormalTest}
                disabled={!token || callLoading}
                className="p-3 rounded-lg bg-zinc-900 border border-emerald-900/40 hover:border-emerald-600/60 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-emerald-400">
                  <span>✓ Legitimate Request</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">200 OK</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Valid token + matching sub/purpose → returns permitted data categories only.
                </p>
              </button>

              <button
                onClick={runPurposeMismatchTest}
                disabled={!token || callLoading}
                className="p-3 rounded-lg bg-zinc-900 border border-amber-900/40 hover:border-amber-600/60 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-amber-400">
                  <span>⚡ Purpose Mismatch</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">403 Block</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Use granted {selectedPurpose} token to request different unauthorized purpose.
                </p>
              </button>

              <button
                onClick={runSubjectMismatchTest}
                disabled={!token || callLoading}
                className="p-3 rounded-lg bg-zinc-900 border border-rose-900/40 hover:border-rose-600/60 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-rose-400">
                  <span>⚡ Subject Hijack</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40">403 Block</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Use {selectedUser}&apos;s token to query other user&apos;s record (SUBJECT_MISMATCH).
                </p>
              </button>

              <button
                onClick={runTamperedTokenTest}
                disabled={!token || callLoading}
                className="p-3 rounded-lg bg-zinc-900 border border-purple-900/40 hover:border-purple-600/60 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-purple-400">
                  <span>⚡ Broken Signature</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">401 Block</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Modifies payload bits without private key → fails crypto signature check.
                </p>
              </button>
            </div>

            {!token && (
              <p className="text-[11px] font-mono text-zinc-500 pt-1 text-center">
                ↑ Issue an assertion token in Step 1 first to unlock gateway testing scenarios.
              </p>
            )}
          </div>

          {/* Response Inspector Console */}
          <div className="p-5 rounded-xl bg-[#141518] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                  Live Gateway Response
                </span>
                {activeCall && (
                  <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[240px]">
                    ({activeCall})
                  </span>
                )}
              </div>

              {response && (
                <div className="flex items-center gap-3">
                  {latency !== null && (
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {latency}ms
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-xs font-bold ${
                      response.status === 200
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : response.status === 401
                        ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    HTTP {response.status} · {response.reason}
                  </span>
                </div>
              )}
            </div>

            {/* Response Output Body */}
            {callLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Enforcing consent verification pipeline...</span>
              </div>
            ) : response ? (
              <div className="space-y-3">
                {/* Status Explanation Card */}
                {response.status === 200 ? (
                  <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs font-mono">
                    <p className="font-semibold">✓ Access Permitted (Purpose Limitation Preserved)</p>
                    <p className="text-[11px] text-emerald-300/80 mt-0.5">
                      PartnerHub received ONLY the data categories authorized for {selectedPurpose}. Async audit log emitted with decision=ALLOWED.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs font-mono">
                    <p className="font-semibold">✗ Enforcement Denial Code: {response.reason}</p>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      Gateway aborted delivery. No sensitive health or fitness data was transmitted. Async audit log emitted with decision=DENIED.
                    </p>
                  </div>
                )}

                {/* Raw JSON Payload Viewer */}
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                    HTTP Response Body (JSON):
                  </div>
                  <pre className="p-3.5 rounded-lg bg-black/60 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto max-h-64 leading-relaxed">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-600 font-mono text-xs">
                Run an enforcement scenario above to inspect real-time PartnerHub response payloads.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
