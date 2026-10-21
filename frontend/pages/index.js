import { useState, useEffect } from 'react'
import Head from 'next/head'
import { Shield, Zap, FileText, Database, Activity, Lock, Cpu, Server } from 'lucide-react'
import ConsentPortal from '../components/ConsentPortal'
import PartnerHubSimulator from '../components/PartnerHubSimulator'
import NoticePublisher from '../components/NoticePublisher'
import AuditLedger from '../components/AuditLedger'

const TABS = [
  { id: 'consent', number: '01', label: 'Consent Portal', sublabel: 'Data Principal Manager', icon: Shield, component: ConsentPortal },
  { id: 'partner', number: '02', label: 'PartnerHub Gateway', sublabel: 'Enforcement Simulator', icon: Zap, component: PartnerHubSimulator },
  { id: 'notices', number: '03', label: 'Notice Governance', sublabel: 'Version & Policy Studio', icon: FileText, component: NoticePublisher },
  { id: 'audit', number: '04', label: 'Cryptographic Ledger', sublabel: 'Audit & Hash Explorer', icon: Database, component: AuditLedger },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('consent')
  const [backendStatus, setBackendStatus] = useState('checking')

  useEffect(() => {
    let mounted = true
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:4000/health')
        if (mounted) {
          setBackendStatus(res.ok ? 'connected' : 'error')
        }
      } catch {
        if (mounted) setBackendStatus('offline')
      }
    }
    checkBackend()
    const interval = setInterval(checkBackend, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component

  return (
    <>
      <Head>
        <title>ConsentGuard — Purpose-Based Consent & Withdrawal Prototype</title>
        <meta name="description" content="Purpose-Based Consent Recording & Withdrawal System (FitNest × PartnerHub)" />
      </Head>

      <div className="min-h-screen bg-[#0c0d0e] text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300">
        {/* Top Minimal Utility Bar */}
        <div className="border-b border-zinc-800/80 bg-[#101114] px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            {/* Left Protocol Tag */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
                Protocol: A3-PS002-TC140
              </span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-400 font-mono text-[11px]">FitNest (Fiduciary) × PartnerHub (Consumer)</span>
            </div>

            {/* Right Telemetry Pointers */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>ES256 P-256</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>SHA-256 Ledger</span>
              </div>
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      backendStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      backendStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </span>
                <span className="font-mono text-[11px] text-zinc-400 capitalize">
                  Backend: {backendStatus === 'connected' ? 'Online (4000)' : backendStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Header */}
        <header className="border-b border-zinc-800/80 bg-[#121316]/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-mono font-bold text-base shadow-inner">
                CG
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-white">ConsentGuard</h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                    Production Prototype
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Purpose-Limitation Verification, Versioned Ledger &amp; Instant Withdrawal Engine
                </p>
              </div>
            </div>

            {/* Segmented Tab Bar */}
            <nav className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-x-auto">
              {TABS.map(({ id, number, label, icon: Icon }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                      isActive
                        ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/70'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <span className={`font-mono text-[10px] ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {number}
                    </span>
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </>
  )
}
