import { Fragment, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  Lock,
  Search,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ApiCheckResult, BugReport, BugStatus, UserRole } from '../types';
import {
  buildAuditCsv,
  canDeleteBug,
  computeAdminPerformanceMetrics,
  computeDashboardMetrics,
  formatRelativeTimestamp,
} from '../utils/bugLogic';

interface BugTrackerDashboardProps {
  role: UserRole;
  checks: ApiCheckResult[];
  bugs: BugReport[];
  onUpdateBugStatus: (bugId: string, status: BugStatus) => void;
  onDeleteBug: (bugId: string) => void;
  onClearResolvedBugs: () => void;
  onLoadDemoData: () => void;
  onNavigateToGenerator: () => void;
}

export function BugTrackerDashboard({
  role,
  checks,
  bugs,
  onUpdateBugStatus,
  onDeleteBug,
  onClearResolvedBugs,
  onLoadDemoData,
  onNavigateToGenerator,
}: BugTrackerDashboardProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | BugStatus>('All');
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);
  const [copiedBugId, setCopiedBugId] = useState<string | null>(null);
  const [csvExportedFlash, setCsvExportedFlash] = useState<boolean>(false);

  const metrics = computeDashboardMetrics(checks, bugs);
  const adminPerf = computeAdminPerformanceMetrics(checks, bugs);
  const isAdmin = canDeleteBug(role);

  const filteredBugs = bugs.filter((bug) => {
    const matchesStatus = statusFilter === 'All' || bug.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      bug.title.toLowerCase().includes(query) ||
      bug.rootCause.toLowerCase().includes(query) ||
      bug.severity.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  const handleCopyMarkdown = async (bug: BugReport) => {
    try {
      await navigator.clipboard.writeText(bug.markdown);
      setCopiedBugId(bug.id);
      window.setTimeout(() => setCopiedBugId(null), 1600);
    } catch {
      // Ignore clipboard permission failures
    }
  };

  const handleExportAuditCsv = () => {
    const csv = buildAuditCsv(checks, bugs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `apiguard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setCsvExportedFlash(true);
    window.setTimeout(() => setCsvExportedFlash(false), 1800);
  };

  const severityColor = (severity: BugReport['severity']) => {
    switch (severity) {
      case 'Critical':
        return 'text-rose-400';
      case 'High':
        return 'text-orange-400';
      case 'Medium':
        return 'text-amber-400';
      case 'Low':
        return 'text-sky-400';
    }
  };

  const statusSelectStyle = (status: BugStatus) => {
    switch (status) {
      case 'Open':
        return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
      case 'In Progress':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
      case 'Resolved':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section
          aria-label="Admin Control Panel"
          data-testid="admin-control-panel"
          className="rounded-xl bg-purple-950/25 border border-purple-500/35 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600/20 border border-amber-400/35 text-purple-300">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Admin Control Panel
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[11px] font-medium text-amber-200">
                    Lead Privileges
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Team performance telemetry, bulk lifecycle cleanup, and audit log exports.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClearResolvedBugs}
                disabled={metrics.resolvedBugs === 0}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#161224] hover:bg-rose-950/50 border border-purple-500/30 hover:border-rose-500/40 text-xs font-semibold text-slate-200 hover:text-rose-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear All Resolved Bugs</span>
              </button>

              <button
                type="button"
                onClick={handleExportAuditCsv}
                disabled={adminPerf.totalTrackedRecords === 0}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/40 disabled:text-purple-200/60 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                {csvExportedFlash ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Audit CSV Exported</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Export Full Audit CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div
            aria-label="Team performance metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1"
          >
            <div className="rounded-lg bg-[#0D111C]/90 border border-purple-500/20 px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-400">
                Team Resolution Rate
              </div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-300">
                {adminPerf.resolutionRatePct}%
              </div>
            </div>

            <div className="rounded-lg bg-[#0D111C]/90 border border-purple-500/20 px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-400">
                Avg API Latency
              </div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-100">
                {adminPerf.avgApiLatencyMs} ms
              </div>
            </div>

            <div className="rounded-lg bg-[#0D111C]/90 border border-purple-500/20 px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-400">
                High/Critical Open
              </div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-300">
                {adminPerf.highPriorityOpenCount}
              </div>
            </div>

            <div className="rounded-lg bg-[#0D111C]/90 border border-purple-500/20 px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-400">
                API Failure Rate
              </div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-300">
                {adminPerf.failingCheckRatePct}%
              </div>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Summary metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          data-testid="metric-total-checks"
          className="rounded-xl bg-[#111827] border border-slate-800/90 p-5"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Total API Checks</span>
            <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono tabular-nums text-slate-100">
            {metrics.totalApiChecks}
          </p>
          <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
            {metrics.totalApiChecks > 0
              ? `${metrics.avgResponseTimeMs} ms avg · ${metrics.failingChecksCount} failing`
              : 'No endpoints probed yet'}
          </p>
        </div>

        <div
          data-testid="metric-open-bugs"
          className="rounded-xl bg-[#111827] border border-slate-800/90 p-5"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Open Bugs</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono tabular-nums text-slate-100">
            {metrics.openBugs}
          </p>
          <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
            {metrics.inProgressBugs} in progress
          </p>
        </div>

        <div
          data-testid="metric-resolved-bugs"
          className="rounded-xl bg-[#111827] border border-slate-800/90 p-5"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Resolved Bugs</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-3xl font-bold font-mono tabular-nums text-slate-100">
            {metrics.resolvedBugs}
          </p>
          <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
            {bugs.length > 0
              ? `${Math.round((metrics.resolvedBugs / bugs.length) * 100)}% resolution rate`
              : '0% resolution rate'}
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/90">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Saved Bug Reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              {!isAdmin && (
                <Lock className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isAdmin
                  ? 'Update triage status, inspect root causes, or remove resolved records.'
                  : 'QA User mode: Admin Only lock active on Resolve and Delete actions.'}
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search
                className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="bug-search" className="sr-only">
                Search saved bugs
              </label>
              <input
                id="bug-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bugs..."
                className="h-9 w-full sm:w-52 pl-8 pr-3 rounded-lg bg-[#0B0F17] border border-slate-700/90 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div
              role="group"
              aria-label="Filter bugs by status"
              className="inline-flex items-center p-1 rounded-lg bg-[#0B0F17] border border-slate-800"
            >
              {(['All', 'Open', 'In Progress', 'Resolved'] as const).map(
                (statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => setStatusFilter(statusOption)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      statusFilter === statusOption
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {statusOption}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {bugs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-200">
              No bugs tracked yet
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Generate a structured report from an error log or load sample recruiter demo data to inspect the workflow.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateToGenerator}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Create Bug Report</span>
              </button>
              <button
                type="button"
                onClick={onLoadDemoData}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Load Demo Data</span>
              </button>
            </div>
          </div>
        ) : filteredBugs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No bugs match your current search or status filter.
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredBugs.map((bug) => {
                const isExpanded = expandedBugId === bug.id;
                return (
                  <div key={bug.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBugId(isExpanded ? null : bug.id)
                        }
                        aria-expanded={isExpanded}
                        className="flex items-start gap-2 text-left text-sm font-medium text-slate-100 hover:text-blue-300 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown
                            className="h-4 w-4 text-slate-400 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4 text-slate-400 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        )}
                        <span>{bug.title}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${severityColor(
                            bug.severity
                          )}`}
                        >
                          {bug.severity}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          {formatRelativeTimestamp(bug.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5">
                          <select
                            aria-label={`Mobile status for ${bug.title}`}
                            title={
                              !isAdmin
                                ? 'Admin Only — Switch to Admin Lead to mark Resolved'
                                : undefined
                            }
                            value={bug.status}
                            onChange={(e) =>
                              onUpdateBugStatus(
                                bug.id,
                                e.target.value as BugStatus
                              )
                            }
                            className={`h-8 px-2.5 rounded-md border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${statusSelectStyle(
                              bug.status
                            )}`}
                          >
                            <option value="Open" className="bg-[#111827] text-slate-100">
                              Open
                            </option>
                            <option
                              value="In Progress"
                              className="bg-[#111827] text-slate-100"
                            >
                              In Progress
                            </option>
                            <option
                              value="Resolved"
                              disabled={!isAdmin}
                              className="bg-[#111827] text-slate-100 disabled:text-slate-500"
                            >
                              Resolved
                            </option>
                          </select>
                          {!isAdmin && (
                            <span
                              title="Admin Only — Resolve status locked"
                              aria-label="Admin Only resolve lock"
                              className="inline-flex items-center text-slate-500"
                            >
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleCopyMarkdown(bug)}
                          aria-label={`Mobile copy Markdown for ${bug.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                        >
                          {copiedBugId === bug.id ? (
                            <Check
                              className="h-3.5 w-3.5 text-emerald-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => onDeleteBug(bug.id)}
                          title={
                            isAdmin
                              ? 'Delete bug record'
                              : 'Admin Only — Switch to Admin Lead to delete bugs'
                          }
                          aria-label={`Mobile delete bug ${bug.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                        >
                          {isAdmin ? (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="ml-6 rounded-lg bg-[#0B0F17] border border-slate-800 p-3 space-y-2.5 text-xs">
                        <div>
                          <span className="font-semibold text-slate-300">
                            Root Cause:{' '}
                          </span>
                          <span className="text-slate-300 leading-relaxed">
                            {bug.rootCause}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-300">
                            Steps to Reproduce:
                          </span>
                          <ol className="list-decimal list-inside mt-1 space-y-0.5 text-slate-400">
                            {bug.stepsToReproduce.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-300">
                            Suggested Fix:{' '}
                          </span>
                          <span className="text-emerald-300/90 leading-relaxed">
                            {bug.suggestedFix}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-medium text-slate-400 bg-[#0E131D]">
                    <th scope="col" className="py-3 pl-5 pr-3">
                      Bug Title
                    </th>
                    <th scope="col" className="py-3 px-3 whitespace-nowrap">
                      Severity
                    </th>
                    <th scope="col" className="py-3 px-3 whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="py-3 px-3 whitespace-nowrap">
                      Logged
                    </th>
                    <th scope="col" className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">
                  {filteredBugs.map((bug) => {
                    const isExpanded = expandedBugId === bug.id;
                    return (
                      <Fragment key={bug.id}>
                        <tr className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 pl-5 pr-3 max-w-md">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBugId(isExpanded ? null : bug.id)
                              }
                              aria-expanded={isExpanded}
                              className="flex items-start gap-2 text-left font-medium text-slate-100 hover:text-blue-300 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown
                                  className="h-4 w-4 text-slate-400 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronRight
                                  className="h-4 w-4 text-slate-400 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="line-clamp-2">{bug.title}</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`text-xs font-semibold ${severityColor(
                                bug.severity
                              )}`}
                            >
                              {bug.severity}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <select
                                aria-label={`Status for ${bug.title}`}
                                title={
                                  !isAdmin
                                    ? 'Admin Only — Switch to Admin Lead to mark Resolved'
                                    : undefined
                                }
                                value={bug.status}
                                onChange={(e) =>
                                  onUpdateBugStatus(
                                    bug.id,
                                    e.target.value as BugStatus
                                  )
                                }
                                className={`h-8 px-2.5 rounded-md border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${statusSelectStyle(
                                  bug.status
                                )}`}
                              >
                                <option value="Open" className="bg-[#111827] text-slate-100">
                                  Open
                                </option>
                                <option
                                  value="In Progress"
                                  className="bg-[#111827] text-slate-100"
                                >
                                  In Progress
                                </option>
                                <option
                                  value="Resolved"
                                  disabled={!isAdmin}
                                  className="bg-[#111827] text-slate-100 disabled:text-slate-500"
                                >
                                  Resolved
                                </option>
                              </select>
                              {!isAdmin && (
                                <span
                                  title="Admin Only — Resolve status locked"
                                  aria-label="Admin Only resolve lock"
                                  className="inline-flex items-center text-slate-500"
                                >
                                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-xs text-slate-400 whitespace-nowrap font-mono tabular-nums">
                            {formatRelativeTimestamp(bug.createdAt)}
                          </td>
                          <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleCopyMarkdown(bug)}
                                aria-label={`Copy Markdown for ${bug.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                              >
                                {copiedBugId === bug.id ? (
                                  <Check
                                    className="h-3.5 w-3.5 text-emerald-400"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={!isAdmin}
                                onClick={() => onDeleteBug(bug.id)}
                                title={
                                  isAdmin
                                    ? 'Delete bug record'
                                    : 'Admin Only — Switch to Admin Lead to delete bugs'
                                }
                                aria-label={`Delete bug ${bug.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                              >
                                {isAdmin ? (
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#0B0F17]/80">
                            <td colSpan={5} className="px-6 py-4 space-y-3 text-xs">
                              <div>
                                <span className="font-semibold text-slate-300">
                                  Root Cause:{' '}
                                </span>
                                <span className="text-slate-300 leading-relaxed">
                                  {bug.rootCause}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-300">
                                  Steps to Reproduce:
                                </span>
                                <ol className="list-decimal list-inside mt-1 space-y-0.5 text-slate-400">
                                  {bug.stepsToReproduce.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-300">
                                  Suggested Fix:{' '}
                                </span>
                                <span className="text-emerald-300/90 leading-relaxed">
                                  {bug.suggestedFix}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/90">
          <h3 className="text-sm font-semibold text-slate-200">
            API Probe Log
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Latest endpoint health checks recorded in localStorage.
          </p>
        </div>

        {checks.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No API checks logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400 bg-[#0E131D]">
                  <th scope="col" className="py-2.5 pl-5 pr-3">
                    Method
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Endpoint
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Status
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Latency
                  </th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                {checks.slice(0, 8).map((check) => (
                  <tr key={check.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-300">
                      {check.method}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-md truncate">
                      {check.url}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={
                          check.ok ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {check.status > 0
                          ? `${check.status} ${check.statusText}`
                          : check.statusText}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300 whitespace-nowrap">
                      {check.responseTimeMs} ms
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right font-sans text-slate-400 whitespace-nowrap">
                      {formatRelativeTimestamp(check.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
