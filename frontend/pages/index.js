import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  Shield, Zap, FileText, BookOpen, User, Circle,
  Menu, X
} from 'lucide-react';
import { getApiBase } from '../utils/api';
import ConsentPortal from '../components/ConsentPortal';
import PartnerHubSimulator from '../components/PartnerHubSimulator';
import NoticePublisher from '../components/NoticePublisher';
import AuditLedger from '../components/AuditLedger';

const NAV_ITEMS = [
  { id: 'consent', label: 'Consent Manager', shortLabel: 'Consent', icon: Shield },
  { id: 'gateway', label: 'API Gateway', shortLabel: 'Gateway', icon: Zap },
  { id: 'notice', label: 'Notice Control', shortLabel: 'Notices', icon: FileText },
  { id: 'audit', label: 'Audit & Ledger', shortLabel: 'Audit', icon: BookOpen },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('consent');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendUp, setBackendUp] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/health`);
      setBackendUp(res.ok);
    } catch {
      setBackendUp(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Close mobile drawer on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const activeItem = NAV_ITEMS.find((n) => n.id === activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'consent':
        return <ConsentPortal />;
      case 'gateway':
        return <PartnerHubSimulator />;
      case 'notice':
        return <NoticePublisher />;
      case 'audit':
        return <AuditLedger />;
      default:
        return null;
    }
  };

  return (
    <>
      <Head>
        <title>ConsentGuard — Purpose-Based Consent Prototype</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col lg:flex-row">
        {/* ──── Mobile Backdrop Overlay ──── */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* ──── Left Sidebar (Fixed on Desktop, Slide-over Drawer on Mobile) ──── */}
        <aside
          className={`fixed top-0 left-0 w-72 lg:w-64 h-screen bg-[#111113] border-r border-zinc-800 flex flex-col z-50 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Logo & Mobile Close */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-zinc-800/60 lg:border-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-semibold text-sm tracking-tight font-mono">CG</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100 tracking-tight">ConsentGuard</p>
                <p className="text-[11px] text-zinc-500 font-mono">FitNest × PartnerHub</p>
              </div>
            </div>

            {/* Close Button on Mobile Drawer */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-800/90 border-l-2 border-emerald-500 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border-l-2 border-transparent'
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-emerald-400' : 'text-zinc-500'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Status */}
          <div className="px-5 pb-5 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs">
              <Circle
                size={8}
                fill={backendUp ? '#34d399' : '#fb7185'}
                stroke="none"
                className={backendUp ? 'animate-pulse' : ''}
              />
              <span className="text-zinc-400">Backend API</span>
              <span className={`ml-auto font-mono text-[11px] ${backendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {backendUp ? 'Online (4000)' : 'Offline'}
              </span>
            </div>
          </div>
        </aside>

        {/* ──── Main Content Area ──── */}
        <div className="flex-1 lg:ml-64 min-h-screen flex flex-col pb-16 lg:pb-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
              {/* Left: Mobile Hamburger + Breadcrumb */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 lg:hidden focus:outline-none"
                  aria-label="Open navigation menu"
                >
                  <Menu size={20} />
                </button>

                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-zinc-500 hidden sm:inline">ConsentGuard</span>
                  <span className="text-zinc-600 hidden sm:inline">/</span>
                  <span className="text-zinc-200 font-medium">{activeItem?.label}</span>
                </div>
              </div>

              {/* Right: User Badge & Status */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
                  <User size={13} strokeWidth={1.8} className="text-emerald-400" />
                  <span>alice</span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>ES256 P-256</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content with Responsive Padding */}
          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:p-8 max-w-7xl w-full mx-auto">
            {renderContent()}
          </main>
        </div>

        {/* ──── Mobile Bottom Navigation Bar (Phone-Friendly Native App Style) ──── */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-[#111113]/95 backdrop-blur-md border-t border-zinc-800 px-2 py-1 flex justify-around items-center"
          aria-label="Mobile Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-400 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-emerald-400' : 'text-zinc-500'} />
                <span className="mt-0.5">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
