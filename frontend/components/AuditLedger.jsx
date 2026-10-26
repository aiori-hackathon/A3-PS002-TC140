'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBase } from '../utils/api';

export default function AuditLedger() {
  const [selectedUser, setSelectedUser] = useState('alice');
  const [events, setEvents] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [tamperSeq, setTamperSeq] = useState(1);
  const [tamperLoading, setTamperLoading] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(null);
  const [demoResults, setDemoResults] = useState({});
  const [demoComplete, setDemoComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const tokenRef = useRef(null);
  const noticeVersionRef = useRef(null);

  // ── Fetch events ──────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/audit/export/${selectedUser}`);
      const data = await res.json();
      setEvents(data.events || []);
      setAccessLogs(data.accessLogs || []);
    } catch {
      setEvents([]);
      setAccessLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchEvents();
    setVerifyResult(null);
  }, [fetchEvents]);

  // ── Verify integrity ─────────────────────────────────────────
  const handleVerify = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/audit/verify/${selectedUser}`);
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult({ chainValid: false, totalEvents: 0 });
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Export JSON ───────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/audit/export/${selectedUser}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${selectedUser}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

  // ── Tamper simulation ─────────────────────────────────────────
  const handleTamper = async () => {
    setTamperLoading(true);
    try {
      await fetch(`${getApiBase()}/api/audit/simulate-tamper/${selectedUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seq: Number(tamperSeq), field: 'action', value: 'TAMPERED' }),
      });
      await fetchEvents();
      await handleVerify();
    } catch {
      // silent
    } finally {
      setTamperLoading(false);
    }
  };

  // ── Demo helpers ──────────────────────────────────────────────
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const fetchCurrentNoticeVersion = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/notices/current`);
      const data = await res.json();
      return Number(data.version || 1);
    } catch {
      return 1;
    }
  };

  const DEMO_STEPS = [
    { id: 1, label: 'Grant P1 for alice' },
    { id: 2, label: 'Issue assertion token' },
    { id: 3, label: 'Access PartnerHub (200)' },
    { id: 4, label: 'Withdraw P1' },
    { id: 5, label: 'Replay old token (403)' },
    { id: 6, label: 'Publish Material Notice' },
    { id: 7, label: 'Re-consent P3 under v2' },
    { id: 8, label: 'Verify hash chain' },
  ];

  const runDemoStep = async (stepId) => {
    switch (stepId) {
      case 1: {
        const nv = await fetchCurrentNoticeVersion();
        noticeVersionRef.current = nv;
        const res = await fetch(`${getApiBase()}/api/consent/grant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'alice', purposeId: 'P1_ANALYTICS', noticeVersion: nv }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Grant failed');
        return { ok: true, msg: `Consent granted under notice v${nv}` };
      }
      case 2: {
        const res = await fetch(`${getApiBase()}/api/assertions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'alice', purposeId: 'P1_ANALYTICS' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Assertion failed');
        tokenRef.current = data.token || data.assertion;
        return { ok: true, msg: `Token issued: ${String(tokenRef.current).slice(0, 20)}...` };
      }
      case 3: {
        const res = await fetch(`${getApiBase()}/api/partnerhub/records?userId=alice&purposeId=P1_ANALYTICS`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
        return { ok: true, msg: `200 OK — Scoped fields: [${Object.keys(data.data || {}).join(', ')}]` };
      }
      case 4: {
        const res = await fetch(`${getApiBase()}/api/consent/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'alice', purposeId: 'P1_ANALYTICS' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdraw failed');
        return { ok: true, msg: 'P1_ANALYTICS consent withdrawn' };
      }
      case 5: {
        const res = await fetch(`${getApiBase()}/api/partnerhub/records?userId=alice&purposeId=P1_ANALYTICS`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          return { ok: true, msg: `403 ${data.reason || data.reasonCode || 'Forbidden'} — token correctly rejected` };
        }
        return { ok: false, msg: `Expected 403 but got ${res.status}` };
      }
      case 6: {
        const res = await fetch(`${getApiBase()}/api/notices/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changeType: 'MATERIAL', affectedPurposes: ['P3_RESEARCH_SHARING'] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Publish failed');
        noticeVersionRef.current = Number(data.version || 2);
        return { ok: true, msg: `Material notice published → v${noticeVersionRef.current}` };
      }
      case 7: {
        const nv = Number(noticeVersionRef.current || 2);
        const res = await fetch(`${getApiBase()}/api/consent/grant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'alice', purposeId: 'P3_RESEARCH_SHARING', noticeVersion: nv }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Re-consent failed');
        return { ok: true, msg: `P3 re-consented under notice v${nv}` };
      }
      case 8: {
        await fetch(`${getApiBase()}/api/audit/flush-queue`, { method: 'POST' });
        const res = await fetch(`${getApiBase()}/api/audit/verify/alice`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verify failed');
        return {
          ok: data.chainValid,
          msg: data.chainValid
            ? `Chain intact — ${data.totalEvents} events verified`
            : `Integrity breach detected`,
        };
      }
      default:
        return { ok: false, msg: 'Unknown step' };
    }
  };

  const handleRunDemo = async () => {
    setDemoRunning(true);
    setDemoComplete(false);
    setDemoResults({});
    setDemoStep(null);

    for (const step of DEMO_STEPS) {
      setDemoStep(step.id);
      await delay(300);
      try {
        const result = await runDemoStep(step.id);
        setDemoResults((prev) => ({ ...prev, [step.id]: result }));
      } catch (err) {
        setDemoResults((prev) => ({
          ...prev,
          [step.id]: { ok: false, msg: err.message || 'Error' },
        }));
      }
      await delay(500);
    }

    setDemoStep(null);
    setDemoComplete(true);
    setDemoRunning(false);
    await fetchEvents();
  };

  // ── Helpers ───────────────────────────────────────────────────
  const truncHash = (hash) => {
    if (!hash) return '—';
    if (hash.length <= 10) return hash;
    return hash.slice(0, 10) + '...';
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  const getStepStatus = (stepId) => {
    if (demoResults[stepId]) return demoResults[stepId].ok ? 'success' : 'failed';
    if (demoStep === stepId) return 'running';
    return 'pending';
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══ SECTION 1: Controls Bar ═══ */}
      <div className="bg-[#111113] border border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* User segmented control */}
          <div className="grid grid-cols-2 sm:flex bg-[#09090b] border border-zinc-800 rounded-lg overflow-hidden">
            {['alice', 'bob'].map((user) => (
              <button
                key={user}
                onClick={() => setSelectedUser(user)}
                className={`px-4 py-2 text-xs sm:text-sm font-mono font-medium transition-colors text-center ${
                  selectedUser === user
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {user}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={verifyLoading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {verifyLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )}
              Verify Integrity
            </button>

            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export JSON
            </button>

            <button
              onClick={fetchEvents}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Verification result banner */}
        {verifyResult && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
              verifyResult.chainValid
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-800 text-rose-300'
            }`}
          >
            {verifyResult.chainValid ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Chain intact — {verifyResult.totalEvents} events verified
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Integrity breach at sequence #{verifyResult.firstBrokenSeq || verifyResult.brokenAt || verifyResult.breakIndex || '?'}
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ SECTION 2: Event Ledger Table ═══ */}
      <div className="bg-[#111113] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-zinc-100 text-sm font-semibold tracking-wide uppercase">
            Event Ledger
          </h3>
          <span className="text-xs text-zinc-500 font-mono">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Seq</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Purpose</th>
                <th className="px-4 py-3 text-left font-medium">CV</th>
                <th className="px-4 py-3 text-left font-medium">NV</th>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Prev Hash</th>
                <th className="px-4 py-3 text-left font-medium">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500 text-sm">
                    {loading ? 'Loading events...' : 'No events recorded'}
                  </td>
                </tr>
              ) : (
                events.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-[#18181b]/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-zinc-400 text-xs">
                      {evt.seq ?? evt.sequence ?? idx + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-semibold ${
                          (evt.action || '').toUpperCase() === 'GRANT'
                            ? 'text-emerald-400'
                            : (evt.action || '').toUpperCase() === 'WITHDRAW'
                            ? 'text-rose-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {evt.action || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-300 text-xs font-mono">
                      {evt.purposeId || evt.purpose || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
                      {evt.consentVersion || evt.cv || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
                      {evt.noticeVersion || evt.nv || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
                      {formatTime(evt.timestamp || evt.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {(evt.seq ?? evt.sequence ?? idx + 1) === 1 ? (
                        <span className="text-zinc-500 italic">GENESIS</span>
                      ) : (
                        <span className="text-zinc-500" title={evt.prevHash || ''}>
                          {truncHash(evt.prevHash)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500" title={evt.hash || ''}>
                      {truncHash(evt.hash)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tamper Simulation */}
        <div className="px-4 sm:px-5 py-3 border-t border-zinc-800 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
            Tamper Simulation:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={tamperSeq}
              onChange={(e) => setTamperSeq(e.target.value)}
              className="w-16 bg-[#09090b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
              placeholder="seq"
            />
            <button
              onClick={handleTamper}
              disabled={tamperLoading}
              className="px-3 py-1.5 text-xs font-medium border border-amber-600 text-amber-400 rounded-lg hover:bg-amber-950/40 transition-colors disabled:opacity-50"
            >
              {tamperLoading ? 'Injecting...' : 'Inject Tamper'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 3: Guided Demo Runner ═══ */}
      <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-zinc-100 text-sm font-semibold tracking-wide uppercase">
              Lifecycle Demo Flight
            </h3>
          </div>

          <button
            onClick={handleRunDemo}
            disabled={demoRunning}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {demoRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Run Full Demo
              </>
            )}
          </button>
        </div>

        {/* Step cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_STEPS.map((step) => {
            const status = getStepStatus(step.id);
            const result = demoResults[step.id];

            return (
              <div
                key={step.id}
                className={`bg-[#09090b] border rounded-xl p-3.5 transition-colors ${
                  status === 'running'
                    ? 'border-blue-700'
                    : status === 'success'
                    ? 'border-emerald-800/60'
                    : status === 'failed'
                    ? 'border-rose-800/60'
                    : 'border-zinc-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Status indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    {status === 'pending' && (
                      <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    )}
                    {status === 'running' && (
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-50" />
                        <div className="relative w-3 h-3 rounded-full bg-blue-500" />
                      </div>
                    )}
                    {status === 'success' && (
                      <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {status === 'failed' && (
                      <div className="w-3 h-3 rounded-full bg-rose-500 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-zinc-600">{step.id}</span>
                      <span className="text-xs text-zinc-200 font-medium leading-snug">
                        {step.label}
                      </span>
                    </div>
                    {result && (
                      <p
                        className={`mt-1.5 text-[10px] leading-relaxed truncate ${
                          result.ok ? 'text-emerald-400/80' : 'text-rose-400/80'
                        }`}
                        title={result.msg}
                      >
                        {result.msg}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Demo complete banner */}
        {demoComplete && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Demo Complete — all {DEMO_STEPS.length} steps executed
          </div>
        )}
      </div>
    </div>
  );
}
