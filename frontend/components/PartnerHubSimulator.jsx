"use client";

import { useState, useCallback } from "react";
import { getApiBase } from "../utils/api";

const USERS = [
  { id: "alice", label: "Alice" },
  { id: "bob", label: "Bob" },
];

const PURPOSES = [
  { id: "P1_ANALYTICS", code: "P1", name: "Usage Analytics" },
  { id: "P2_PERSONALISATION", code: "P2", name: "Experience Personalization" },
  { id: "P3_RESEARCH_SHARING", code: "P3", name: "Research Data Sharing" },
];

function StatusBadge({ status }) {
  if (!status) return null;
  let color = "bg-zinc-700 text-zinc-300";
  if (status >= 200 && status < 300) color = "bg-emerald-900/60 text-emerald-400";
  else if (status === 401) color = "bg-rose-900/60 text-rose-400";
  else if (status === 403) color = "bg-amber-900/60 text-amber-400";
  else if (status >= 500) color = "bg-rose-900/60 text-rose-400";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-mono font-semibold ${color}`}>
      {status}
    </span>
  );
}

function truncate(str, len = 12) {
  if (!str) return "";
  if (typeof str !== "string") str = String(str);
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatExp(exp) {
  if (!exp) return "—";
  try {
    return new Date(exp * 1000).toLocaleTimeString();
  } catch {
    return String(exp);
  }
}

export default function PartnerHubSimulator() {
  const [userId, setUserId] = useState("alice");
  const [purposeId, setPurposeId] = useState("P1_ANALYTICS");
  const [token, setToken] = useState(null);
  const [claims, setClaims] = useState(null);
  const [assertionError, setAssertionError] = useState(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [showRawToken, setShowRawToken] = useState(false);

  const [response, setResponse] = useState(null);
  const [latency, setLatency] = useState(null);
  const [enforcementLoading, setEnforcementLoading] = useState(false);
  const [expandResponse, setExpandResponse] = useState(false);

  const signAssertion = useCallback(async () => {
    setSigningLoading(true);
    setAssertionError(null);
    setToken(null);
    setClaims(null);
    setShowRawToken(false);
    try {
      const res = await fetch(`${getApiBase()}/api/assertions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, purposeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAssertionError(data.reason || data.error || `Assertion failed (${res.status})`);
        return;
      }
      setToken(data.token);
      setClaims(data.claims || null);
    } catch (err) {
      setAssertionError(err.message || "Network error");
    } finally {
      setSigningLoading(false);
    }
  }, [userId, purposeId]);

  const runScenario = useCallback(
    async (scenario) => {
      if (!token) return;
      setEnforcementLoading(true);
      setResponse(null);
      setLatency(null);
      setExpandResponse(false);

      let queryUser = userId;
      let queryPurpose = purposeId;
      let authToken = token;

      if (scenario === "cross-purpose") {
        const other = PURPOSES.find((p) => p.id !== purposeId);
        if (other) queryPurpose = other.id;
      } else if (scenario === "identity-spoof") {
        const other = USERS.find((u) => u.id !== userId);
        if (other) queryUser = other.id;
      } else if (scenario === "signature-forge") {
        const parts = token.split(".");
        if (parts.length === 3) {
          try {
            const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
            const payload = JSON.parse(payloadJson);
            payload.sub = payload.sub === "alice" ? "bob" : "alice";
            const modified = btoa(JSON.stringify(payload))
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");
            authToken = `${parts[0]}.${modified}.${parts[2]}`;
          } catch {
            // keep original token if parsing fails
          }
        }
      }

      const url = `${getApiBase()}/api/partnerhub/records?userId=${encodeURIComponent(queryUser)}&purposeId=${encodeURIComponent(queryPurpose)}`;
      const start = performance.now();

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const elapsed = Math.round(performance.now() - start);
        setLatency(elapsed);
        let body;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        setResponse({ status: res.status, body });
      } catch (err) {
        const elapsed = Math.round(performance.now() - start);
        setLatency(elapsed);
        setResponse({ status: 0, body: { error: err.message } });
      } finally {
        setEnforcementLoading(false);
      }
    },
    [token, userId, purposeId]
  );

  const scenarios = [
    {
      key: "normal",
      label: "Normal Access",
      desc: "Valid token, correct user and purpose",
      expected: "200",
      expectedColor: "text-emerald-500",
      handler: () => runScenario("normal"),
    },
    {
      key: "cross-purpose",
      label: "Cross-Purpose",
      desc: "Valid token, switched purpose param",
      expected: "403",
      expectedColor: "text-amber-500",
      handler: () => runScenario("cross-purpose"),
    },
    {
      key: "identity-spoof",
      label: "Identity Spoof",
      desc: "Valid token, switched user param",
      expected: "403",
      expectedColor: "text-amber-500",
      handler: () => runScenario("identity-spoof"),
    },
    {
      key: "signature-forge",
      label: "Signature Forge",
      desc: "Tampered JWT payload, original signature",
      expected: "401",
      expectedColor: "text-rose-500",
      handler: () => runScenario("signature-forge"),
    },
  ];

  const selectedPurpose = PURPOSES.find((p) => p.id === purposeId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT PANEL — Token Factory */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
          <h2 className="text-zinc-100 text-lg font-semibold mb-4">Token Factory</h2>

          {/* User Selector */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">User</label>
            <div className="flex gap-2">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUserId(u.id)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    userId === u.id
                      ? "bg-zinc-700 text-zinc-100 border border-zinc-600"
                      : "bg-[#18181b] text-zinc-400 border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose Selector */}
          <div className="mb-5">
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Purpose</label>
            <div className="space-y-1.5">
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPurposeId(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    purposeId === p.id
                      ? "bg-zinc-700 border border-zinc-600"
                      : "bg-[#18181b] border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <span className="font-mono text-xs text-zinc-500 bg-[#09090b] px-2 py-0.5 rounded">
                    {p.code}
                  </span>
                  <span className={`text-sm ${purposeId === p.id ? "text-zinc-100" : "text-zinc-400"}`}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sign Button */}
          <button
            onClick={signAssertion}
            disabled={signingLoading}
            className="w-full py-3 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingLoading ? "Signing..." : "Sign Assertion"}
          </button>
        </div>

        {/* Assertion Error */}
        {assertionError && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4">
            <p className="text-xs text-rose-400 uppercase tracking-wider mb-1">Assertion Failed</p>
            <p className="text-sm text-rose-300">{assertionError}</p>
          </div>
        )}

        {/* Decoded Claims */}
        {claims && (
          <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
            <h3 className="text-zinc-100 text-sm font-semibold mb-3">Decoded Claims</h3>
            <ul className="space-y-2">
              {[
                { label: "sub", value: claims.sub },
                { label: "purpose", value: claims.purpose },
                { label: "cv", value: claims.cv },
                { label: "nv", value: claims.nv },
                { label: "scope", value: truncate(claims.scope) },
                { label: "aud", value: claims.aud },
                { label: "exp", value: formatExp(claims.exp) },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 font-mono text-xs">{row.label}</span>
                  <span className="text-zinc-200 font-mono text-xs">{row.value ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Raw Token (collapsible) */}
        {token && (
          <div className="bg-[#111113] border border-zinc-800 rounded-xl">
            <button
              onClick={() => setShowRawToken((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <span className="text-sm text-zinc-400">Raw Token</span>
              <span className="text-zinc-600 text-xs">{showRawToken ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {showRawToken && (
              <div className="px-5 pb-4">
                <p className="text-xs font-mono text-zinc-500 break-all leading-relaxed select-all">
                  {token}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL — Enforcement Console */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
          <h2 className="text-zinc-100 text-lg font-semibold mb-4">Enforcement Console</h2>

          {/* Scenario Buttons (2x2 grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {scenarios.map((s) => (
              <button
                key={s.key}
                onClick={s.handler}
                disabled={!token || enforcementLoading}
                className="bg-[#18181b] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 mb-1">
                  {s.label}
                </p>
                <p className="text-xs text-zinc-500 mb-2">{s.desc}</p>
                <p className="text-xs">
                  <span className="text-zinc-600">Expected: </span>
                  <span className={`font-mono font-semibold ${s.expectedColor}`}>{s.expected}</span>
                </p>
              </button>
            ))}
          </div>

          {!token && (
            <p className="text-xs text-zinc-600 text-center py-4">
              Sign an assertion first to enable test scenarios
            </p>
          )}
        </div>

        {/* Response Inspector */}
        {response && (
          <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5">
            <h3 className="text-zinc-100 text-sm font-semibold mb-4">Response Inspector</h3>

            <div className="flex items-center gap-4 mb-4">
              <StatusBadge status={response.status} />
              {response.body?.reason && (
                <span className="text-xs text-zinc-400 font-mono">
                  {response.body.reason}
                </span>
              )}
              {latency !== null && (
                <span className="text-xs text-zinc-600 font-mono ml-auto">
                  {latency}ms
                </span>
              )}
            </div>

            {/* Expandable JSON Body */}
            <div className="bg-[#09090b] border border-zinc-800 rounded-lg">
              <button
                onClick={() => setExpandResponse((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left"
              >
                <span className="text-xs text-zinc-500">Response Body</span>
                <span className="text-zinc-600 text-xs">{expandResponse ? "▲ Collapse" : "▼ Expand"}</span>
              </button>
              {expandResponse && response.body && (
                <pre className="px-4 pb-4 text-xs font-mono text-zinc-400 overflow-x-auto leading-relaxed">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {enforcementLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
