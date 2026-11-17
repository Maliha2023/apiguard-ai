import { Activity, LayoutDashboard, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { TabId, UserRole } from '../types';

interface SidebarProps {
  role: UserRole;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  apiChecksCount: number;
  openBugsCount: number;
  totalBugsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  role,
  activeTab,
  onSelectTab,
  apiChecksCount,
  openBugsCount,
  totalBugsCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const isAdmin = role === 'Admin Lead';
  const navItems: Array<{
    id: TabId;
    label: string;
    icon: typeof Activity;
    count: number;
    countLabel: string;
  }> = [
    {
      id: 'health',
      label: 'API Health Checker',
      icon: Activity,
      count: apiChecksCount,
      countLabel: `${apiChecksCount} logged API checks`,
    },
    {
      id: 'generator',
      label: 'AI Bug Report',
      icon: Sparkles,
      count: 0,
      countLabel: 'AI Bug Report Generator',
    },
    {
      id: 'tracker',
      label: 'Bug & Test Tracker',
      icon: LayoutDashboard,
      count: openBugsCount > 0 ? openBugsCount : totalBugsCount,
      countLabel: `${openBugsCount} open bugs`,
    },
  ];

  const handleNavClick = (id: TabId) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#0E131D] border-r border-slate-800/90 px-4 py-5">
      <div>
        <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isAdmin
                  ? 'bg-purple-600/15 border-purple-500/30 text-purple-400'
                  : 'bg-blue-600/15 border-blue-500/30 text-blue-400'
              }`}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap truncate">
                APIGuard AI
              </span>
              <span className="block text-[10px] font-medium text-slate-400 whitespace-nowrap truncate">
                API Monitor &amp; Bug Triage
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Primary sections" className="mt-5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const activeClasses = isAdmin
              ? 'bg-purple-600/15 text-purple-200 border border-purple-500/30'
              : 'bg-blue-600/15 text-blue-300 border border-blue-500/30';
            const activeIconClass = isAdmin ? 'text-purple-400' : 'text-blue-400';
            const activeCountClass = isAdmin ? 'text-purple-300' : 'text-blue-300';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ${
                  isAdmin ? 'focus-visible:ring-purple-500' : 'focus-visible:ring-blue-500'
                } ${
                  isActive
                    ? activeClasses
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? activeIconClass : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id !== 'generator' && (
                  <span
                    aria-label={item.countLabel}
                    className={`font-mono tabular-nums text-xs ${
                      isActive ? activeCountClass : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800/80 px-2">
        <p className="text-xs leading-relaxed text-slate-500">
          Checks and bug reports are persisted locally in your browser storage.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
