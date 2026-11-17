import { useState } from 'react';
import { Check, Database, Menu, Shield, UserCheck } from 'lucide-react';
import { ApiHealthChecker } from './components/ApiHealthChecker';
import { AiBugGenerator } from './components/AiBugGenerator';
import { BugTrackerDashboard } from './components/BugTrackerDashboard';
import { Sidebar } from './components/Sidebar';
import type {
  ApiCheckResult,
  BugReport,
  BugStatus,
  TabId,
  UserRole,
} from './types';
import { canChangeBugStatus, canDeleteBug, clearResolvedBugs } from './utils/bugLogic';
import {
  createDemoData,
  loadApiChecks,
  loadBugs,
  loadUserRole,
  saveApiChecks,
  saveBugs,
  saveUserRole,
} from './utils/storage';

const TAB_TITLES: Record<TabId, string> = {
  health: 'API Health Checker',
  generator: 'AI Bug Report',
  tracker: 'Bug & Test Tracker',
};

export default function App() {
  const [role, setRole] = useState<UserRole>(() => loadUserRole());
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    loadUserRole() === 'Admin Lead' ? 'tracker' : 'health'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [apiChecks, setApiChecks] = useState<ApiCheckResult[]>(() =>
    loadApiChecks()
  );
  const [bugs, setBugs] = useState<BugReport[]>(() => loadBugs());
  const [draftErrorText, setDraftErrorText] = useState<string>('');
  const [draftSourceUrl, setDraftSourceUrl] = useState<string | undefined>(
    undefined
  );
  const [demoLoadedFlash, setDemoLoadedFlash] = useState<boolean>(false);

  const openBugsCount = bugs.filter((b) => b.status === 'Open').length;
  const isAdmin = role === 'Admin Lead';

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    saveUserRole(nextRole);
    setActiveTab(nextRole === 'Admin Lead' ? 'tracker' : 'health');
  };

  const handleRecordCheck = (result: ApiCheckResult) => {
    setApiChecks((prev) => {
      const next = [result, ...prev];
      saveApiChecks(next);
      return next;
    });
  };

  const handleClearHistory = () => {
    setApiChecks([]);
    saveApiChecks([]);
  };

  const handleSaveBug = (bug: BugReport) => {
    setBugs((prev) => {
      const next = [bug, ...prev];
      saveBugs(next);
      return next;
    });
  };

  const handleUpdateBugStatus = (bugId: string, status: BugStatus) => {
    if (!canChangeBugStatus(role, status)) {
      return;
    }
    setBugs((prev) => {
      const next = prev.map((bug) =>
        bug.id === bugId ? { ...bug, status } : bug
      );
      saveBugs(next);
      return next;
    });
  };

  const handleDeleteBug = (bugId: string) => {
    if (!canDeleteBug(role)) {
      return;
    }
    setBugs((prev) => {
      const next = prev.filter((bug) => bug.id !== bugId);
      saveBugs(next);
      return next;
    });
  };

  const handleClearResolvedBugs = () => {
    if (!canDeleteBug(role)) {
      return;
    }
    setBugs((prev) => {
      const next = clearResolvedBugs(prev);
      saveBugs(next);
      return next;
    });
  };

  const handleLoadDemoData = () => {
    const demo = createDemoData();
    setApiChecks(demo.checks);
    setBugs(demo.bugs);
    saveApiChecks(demo.checks);
    saveBugs(demo.bugs);
    setDemoLoadedFlash(true);
    window.setTimeout(() => setDemoLoadedFlash(false), 1800);
  };

  const handleSendErrorToAi = (rawErrorText: string, sourceUrl?: string) => {
    setDraftErrorText(rawErrorText);
    setDraftSourceUrl(sourceUrl);
    setActiveTab('generator');
  };

  return (
    <div className="min-h-screen flex bg-[#0B0F17] text-slate-100">
      <Sidebar
        activeTab={activeTab}
        role={role}
        onSelectTab={setActiveTab}
        apiChecksCount={apiChecks.length}
        openBugsCount={openBugsCount}
        totalBugsCount={bugs.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 h-16 backdrop-blur-sm border-b transition-colors ${
            isAdmin
              ? 'bg-[#120F1F]/95 border-purple-500/40'
              : 'bg-[#0B0F17]/95 border-slate-800/90'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-[#111827] text-slate-300 hover:text-white transition-colors shrink-0"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden md:inline text-sm text-slate-500 whitespace-nowrap">
                APIGuard AI
              </span>
              <span className="hidden md:inline text-slate-600" aria-hidden="true">
                /
              </span>
              <h1 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
              {isAdmin && (
                <span
                  data-testid="admin-mode-badge"
                  className="hidden md:inline-flex items-center gap-1.5 ml-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 border border-amber-400/35 text-[11px] font-semibold text-purple-200 whitespace-nowrap shrink-0"
                >
                  <Shield className="h-3 w-3 text-amber-300" aria-hidden="true" />
                  <span>Admin Mode Active</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Role Switcher"
              className="inline-flex items-center p-0.5 rounded-lg bg-[#111827] border border-slate-800"
            >
              <button
                type="button"
                onClick={() => handleRoleChange('QA User')}
                aria-pressed={role === 'QA User'}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  role === 'QA User'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 hidden sm:inline" aria-hidden="true" />
                <span>QA User</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('Admin Lead')}
                aria-pressed={role === 'Admin Lead'}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  role === 'Admin Lead'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="h-3.5 w-3.5 hidden sm:inline" aria-hidden="true" />
                <span>Admin Lead</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadDemoData}
              aria-label={demoLoadedFlash ? 'Demo Data Loaded' : 'Load Demo Data'}
              title="Load Demo Data"
              className="inline-flex h-9 w-9 sm:w-auto items-center justify-center gap-2 sm:px-3.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-700/90 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {demoLoadedFlash ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Demo Data Loaded</span>
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Load Demo Data</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div
          data-testid="role-workspace-banner"
          role="status"
          className={`px-4 sm:px-6 lg:px-8 py-2 border-b text-xs font-medium flex items-center gap-2 transition-colors ${
            isAdmin
              ? 'bg-purple-950/35 border-purple-500/30 text-purple-200'
              : 'bg-blue-950/35 border-blue-500/25 text-blue-200'
          }`}
        >
          {isAdmin ? (
            <>
              <Shield className="h-3.5 w-3.5 text-purple-400 shrink-0" aria-hidden="true" />
              <span>
                Admin Lead Workspace: Manage bug lifecycle, resolve issues &amp; export reports
              </span>
            </>
          ) : (
            <>
              <UserCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" aria-hidden="true" />
              <span>
                QA Tester Workspace: Run API checks &amp; report bugs
              </span>
            </>
          )}
        </div>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl w-full mx-auto">
          {activeTab === 'health' && (
            <ApiHealthChecker
              checks={apiChecks}
              onRecordCheck={handleRecordCheck}
              onClearHistory={handleClearHistory}
              onSendErrorToAi={handleSendErrorToAi}
            />
          )}

          {activeTab === 'generator' && (
            <AiBugGenerator
              initialRawError={draftErrorText}
              initialSourceUrl={draftSourceUrl}
              onSaveBug={handleSaveBug}
              onGoToTracker={() => setActiveTab('tracker')}
            />
          )}

          {activeTab === 'tracker' && (
            <BugTrackerDashboard
              role={role}
              checks={apiChecks}
              bugs={bugs}
              onUpdateBugStatus={handleUpdateBugStatus}
              onDeleteBug={handleDeleteBug}
              onClearResolvedBugs={handleClearResolvedBugs}
              onLoadDemoData={handleLoadDemoData}
              onNavigateToGenerator={() => setActiveTab('generator')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
