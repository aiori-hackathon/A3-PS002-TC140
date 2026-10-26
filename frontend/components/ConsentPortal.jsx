import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { getApiBase } from '../utils/api';

const PURPOSES = [
  {
    id: 'P1_ANALYTICS',
    code: 'P1',
    title: 'Usage Analytics',
    desc: 'Anonymous app interaction events and session frequency metrics',
    categories: ['appUsageEvents', 'sessionCount'],
  },
  {
    id: 'P2_PERSONALISATION',
    code: 'P2',
    title: 'Experience Personalization',
    desc: 'Activity patterns and preference signals for adaptive recommendations',
    categories: ['activitySummary', 'preferences'],
  },
  {
    id: 'P3_RESEARCH_SHARING',
    code: 'P3',
    title: 'Research Data Sharing',
    desc: 'De-identified biometric telemetry shared with certified research partners',
    categories: ['pseudonymisedHeartRate', 'sleepHours'],
  },
];

const STATUS_STYLES = {
  GRANTED: { dot: 'bg-emerald-400', label: 'Active', text: 'text-emerald-400' },
  WITHDRAWN: { dot: 'bg-rose-400', label: 'Revoked', text: 'text-rose-400' },
  NONE: { dot: 'bg-zinc-500', label: 'Pending', text: 'text-zinc-500' },
};

export default function ConsentPortal() {
  const [userId, setUserId] = useState('alice');
  const [consentData, setConsentData] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchConsent = useCallback(async () => {
    setLoading(true);
    try {
      const [consentRes, auditRes] = await Promise.all([
        fetch(`${getApiBase()}/api/consent/${userId}`),
        fetch(`${getApiBase()}/api/audit/export/${userId}`),
      ]);
      const consent = await consentRes.json();
      setConsentData(consent);

      if (auditRes.ok) {
        const audit = await auditRes.json();
        const events = audit.events || audit || [];
        setEventCount(Array.isArray(events) ? events.length : 0);
      }
    } catch (err) {
      showToast('Failed to fetch consent data', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

  const handleGrant = async (purposeId) => {
    setActionLoading(`grant-${purposeId}`);
    try {
      const noticeVersion = consentData?.currentNotice?.version || consentData?.notice?.version || 1;
      const res = await fetch(`${getApiBase()}/api/consent/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, purposeId, noticeVersion }),
      });
      if (!res.ok) throw new Error('Grant failed');
      showToast(`Consent granted for ${purposeId}`);
      await fetchConsent();
    } catch {
      showToast('Failed to grant consent', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdraw = async (purposeId) => {
    setActionLoading(`withdraw-${purposeId}`);
    try {
      const res = await fetch(`${getApiBase()}/api/consent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, purposeId }),
      });
      if (!res.ok) throw new Error('Withdraw failed');
      showToast(`Consent withdrawn for ${purposeId}`);
      await fetchConsent();
    } catch {
      showToast('Failed to withdraw consent', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const purposes = consentData?.purposes || {};
  const grantedCount = PURPOSES.filter((p) => purposes[p.id]?.status === 'GRANTED').length;
  const noticeVersion = consentData?.currentNotice?.version || consentData?.notice?.version || '—';

  return (
    <div className="space-y-6">
      {/* ──── Top Bar: User Selector + Stats ──── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Segmented Control */}
        <div className="grid grid-cols-2 sm:flex bg-[#111113] border border-zinc-800 rounded-lg p-0.5">
          {['alice', 'bob'].map((u) => (
            <button
              key={u}
              onClick={() => setUserId(u)}
              className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-mono transition-colors text-center ${
                userId === u
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:gap-3">
          <StatBox label="Granted" value={`${grantedCount}/3`} accent="emerald" />
          <StatBox label="Notice" value={`v${noticeVersion}`} accent="blue" />
          <StatBox label="Events" value={String(eventCount)} accent="zinc" />
        </div>
      </div>

      {/* ──── Purpose Cards ──── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
          <span className="ml-2 text-sm text-zinc-500">Loading consent data&hellip;</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PURPOSES.map((purpose) => {
            const data = purposes[purpose.id] || {};
            const status = data.status || 'NONE';
            const style = STATUS_STYLES[status] || STATUS_STYLES.NONE;
            const cv = data.cv ?? 0;
            const nv = data.noticeVersion ?? 0;
            const isOutdated =
              consentData?.outdatedFlags?.[purpose.id] ||
              consentData?.needsReConsent?.[purpose.id] ||
              false;
            const isGranted = status === 'GRANTED';
            const grantDisabled = isGranted && !isOutdated;
            const withdrawDisabled = !isGranted;
            const isGrantLoading = actionLoading === `grant-${purpose.id}`;
            const isWithdrawLoading = actionLoading === `withdraw-${purpose.id}`;

            return (
              <div
                key={purpose.id}
                className="bg-[#111113] border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 hover:border-zinc-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] font-mono font-medium text-zinc-300">
                      {purpose.code}
                    </span>
                    <span className="text-sm font-medium text-zinc-100">{purpose.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    <span className={`text-[11px] font-mono ${style.text}`}>{style.label}</span>
                  </div>
                </div>

                {/* Description + Categories */}
                <div className="space-y-2.5">
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{purpose.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {purpose.categories.map((cat) => (
                      <code
                        key={cat}
                        className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-[11px] font-mono text-zinc-400"
                      >
                        {cat}
                      </code>
                    ))}
                  </div>
                </div>

                {/* Outdated Warning */}
                {isOutdated && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                    <span className="text-[11px] text-amber-400">
                      Notice amendment requires re-authorization
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-auto pt-2 border-t border-zinc-800/60">
                  {/* Counters */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-zinc-500">
                      cv: {cv}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      nv: {nv}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGrant(purpose.id)}
                      disabled={grantDisabled || isGrantLoading}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        grantDisabled
                          ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                      }`}
                    >
                      {isGrantLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                      {isOutdated && isGranted ? 'Re-authorize' : 'Authorize'}
                    </button>
                    <button
                      onClick={() => handleWithdraw(purpose.id)}
                      disabled={withdrawDisabled || isWithdrawLoading}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                        withdrawDisabled
                          ? 'bg-zinc-800/40 text-zinc-600 border-zinc-800 cursor-not-allowed'
                          : 'bg-[#18181b] text-zinc-300 border-zinc-700 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                      }`}
                    >
                      {isWithdrawLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <X size={13} />
                      )}
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──── Toast ──── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium border shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }) {
  const accents = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    zinc: 'text-zinc-300',
  };

  return (
    <div className="bg-[#111113] border border-zinc-800 rounded-lg px-2.5 sm:px-3.5 py-2 text-center sm:text-left flex-1 sm:flex-initial sm:min-w-[80px]">
      <p className="text-[10px] sm:text-[11px] text-zinc-500 mb-0.5 truncate">{label}</p>
      <p className={`text-xs sm:text-sm font-mono font-medium ${accents[accent] || 'text-zinc-300'}`}>
        {value}
      </p>
    </div>
  );
}
