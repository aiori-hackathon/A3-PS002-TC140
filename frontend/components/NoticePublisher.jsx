"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "../utils/api";

const PURPOSES = [
  { id: "P1_ANALYTICS", code: "P1", name: "Usage Analytics" },
  { id: "P2_PERSONALISATION", code: "P2", name: "Experience Personalization" },
  { id: "P3_RESEARCH_SHARING", code: "P3", name: "Research Data Sharing" },
];

const CHANGE_TYPES = [
  {
    value: "MATERIAL",
    label: "Material Amendment",
    desc: "Expands data scope, invalidates affected consents",
    color: "amber",
  },
  {
    value: "TYPO_NON_MATERIAL",
    label: "Editorial Correction",
    desc: "Minor text fixes, no consent impact",
    color: "zinc",
  },
];

function ChangeTypeBadge({ type }) {
  if (!type) return null;
  const isMaterial = type === "MATERIAL";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold ${
        isMaterial
          ? "bg-amber-900/60 text-amber-400"
          : "bg-zinc-700 text-zinc-300"
      }`}
    >
      {type}
    </span>
  );
}

export default function NoticePublisher() {
  // Current notice state
  const [notice, setNotice] = useState(null);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [noticeError, setNoticeError] = useState(null);

  // Publish form state
  const [changeType, setChangeType] = useState("MATERIAL");
  const [affectedPurposes, setAffectedPurposes] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const fetchCurrentNotice = useCallback(async () => {
    setNoticeLoading(true);
    setNoticeError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/notices/current`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch notice (${res.status})`);
      }
      const data = await res.json();
      setNotice(data);
    } catch (err) {
      setNoticeError(err.message || "Failed to load notice");
    } finally {
      setNoticeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentNotice();
  }, [fetchCurrentNotice]);

  const togglePurpose = useCallback((purposeId) => {
    setAffectedPurposes((prev) =>
      prev.includes(purposeId)
        ? prev.filter((id) => id !== purposeId)
        : [...prev, purposeId]
    );
  }, []);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setPublishResult(null);
    setPublishError(null);
    try {
      const body = { changeType };
      if (changeType === "MATERIAL") {
        body.affectedPurposes = affectedPurposes;
      }
      const res = await fetch(`${getApiBase()}/api/notices/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Publish failed (${res.status})`);
      }
      setPublishResult(data);
      setAffectedPurposes([]);
      await fetchCurrentNotice();
    } catch (err) {
      setPublishError(err.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }, [changeType, affectedPurposes, fetchCurrentNotice]);

  const purposeEntries = notice?.purposes ? Object.entries(notice.purposes) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT COLUMN — Current Notice */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
          <h2 className="text-zinc-100 text-lg font-semibold mb-4">Current Notice</h2>

          {noticeLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          )}

          {noticeError && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-3">
              <p className="text-sm text-rose-300">{noticeError}</p>
            </div>
          )}

          {notice && !noticeLoading && (
            <div className="space-y-5">
              {/* Version & Change Type */}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Version</p>
                  <p className="text-3xl font-semibold text-zinc-100 font-mono">
                    v{notice.version}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Change Type</p>
                  <ChangeTypeBadge type={notice.changeType} />
                </div>
              </div>

              {notice.publishedAt && (
                <p className="text-xs text-zinc-600">
                  Published {new Date(notice.publishedAt).toLocaleString()}
                </p>
              )}

              {/* Purposes List */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Purposes</p>
                <div className="space-y-2">
                  {purposeEntries.map(([key, purpose]) => {
                    const meta = PURPOSES.find((p) => p.id === key);
                    return (
                      <div
                        key={key}
                        className="bg-[#18181b] border border-zinc-800 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-zinc-500 bg-[#09090b] px-2 py-0.5 rounded">
                              {meta?.code || key}
                            </span>
                            <span className="text-sm text-zinc-200">{purpose.title}</span>
                          </div>
                          {purpose.materialChangeFromPrev && (
                            <span className="text-xs bg-amber-900/60 text-amber-400 px-2 py-0.5 rounded font-mono">
                              material change
                            </span>
                          )}
                        </div>
                        {purpose.description && (
                          <p className="text-xs text-zinc-500 mt-1">{purpose.description}</p>
                        )}
                        {purpose.dataCategories && purpose.dataCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {purpose.dataCategories.map((cat) => (
                              <span
                                key={cat}
                                className="text-xs font-mono bg-[#09090b] text-zinc-500 px-2 py-0.5 rounded"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Affected Purposes */}
              {notice.affectedPurposes && notice.affectedPurposes.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                    Affected Purposes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {notice.affectedPurposes.map((p) => {
                      const meta = PURPOSES.find((pp) => pp.id === p);
                      return (
                        <span
                          key={p}
                          className="text-xs font-mono bg-amber-900/40 text-amber-400 px-2.5 py-1 rounded-lg"
                        >
                          {meta?.code || p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN — Publish Amendment */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
          <h2 className="text-zinc-100 text-lg font-semibold mb-4">Publish Amendment</h2>

          {/* Change Type Radio Cards */}
          <div className="space-y-3 mb-5">
            <label className="block text-xs text-zinc-500 uppercase tracking-wider">
              Change Type
            </label>
            {CHANGE_TYPES.map((ct) => {
              const selected = changeType === ct.value;
              const isAmber = ct.color === "amber";
              let borderColor = "border-zinc-800 hover:border-zinc-700";
              if (selected && isAmber) borderColor = "border-amber-700";
              else if (selected) borderColor = "border-zinc-600";

              return (
                <button
                  key={ct.value}
                  onClick={() => setChangeType(ct.value)}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl text-left transition-colors bg-[#18181b] border ${borderColor}`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected
                        ? isAmber
                          ? "border-amber-500"
                          : "border-zinc-400"
                        : "border-zinc-700"
                    }`}
                  >
                    {selected && (
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isAmber ? "bg-amber-500" : "bg-zinc-400"
                        }`}
                      />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        selected
                          ? isAmber
                            ? "text-amber-400"
                            : "text-zinc-200"
                          : "text-zinc-400"
                      }`}
                    >
                      {ct.label}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{ct.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Affected Purposes (only for MATERIAL) */}
          {changeType === "MATERIAL" && (
            <div className="mb-5">
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Affected Purposes
              </label>
              <div className="space-y-2">
                {PURPOSES.map((p) => {
                  const checked = affectedPurposes.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePurpose(p.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors border ${
                        checked
                          ? "bg-amber-950/30 border-amber-800/60"
                          : "bg-[#18181b] border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked
                            ? "bg-amber-600 border-amber-600"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {checked && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="font-mono text-xs text-zinc-500 bg-[#09090b] px-2 py-0.5 rounded">
                        {p.code}
                      </span>
                      <span className={`text-sm ${checked ? "text-zinc-200" : "text-zinc-400"}`}>
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            disabled={publishing || (changeType === "MATERIAL" && affectedPurposes.length === 0)}
            className="w-full py-3 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "Publishing..." : "Publish Amendment"}
          </button>

          {/* Success Message */}
          {publishResult && (
            <div className="mt-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-4">
              <p className="text-sm text-emerald-300">
                Notice published successfully — now at version{" "}
                <span className="font-mono font-semibold">
                  v{publishResult.version || publishResult.newVersion}
                </span>
              </p>
            </div>
          )}

          {/* Error Message */}
          {publishError && (
            <div className="mt-4 bg-rose-950/40 border border-rose-800/60 rounded-lg p-4">
              <p className="text-sm text-rose-300">{publishError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
