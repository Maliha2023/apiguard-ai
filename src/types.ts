export type HttpMethod = 'GET' | 'POST';

export type TabId = 'health' | 'generator' | 'tracker';

export type UserRole = 'QA User' | 'Admin Lead';

export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type BugStatus = 'Open' | 'In Progress' | 'Resolved';

export interface ApiCheckResult {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  responseTimeMs: number;
  ok: boolean;
  isSimulated?: boolean;
  responseBody: string;
  errorMessage?: string;
  timestamp: string;
}

export interface ParsedBugReport {
  title: string;
  severity: BugSeverity;
  rootCause: string;
  stepsToReproduce: string[];
  suggestedFix: string;
  markdown: string;
}

export interface BugReport {
  id: string;
  title: string;
  severity: BugSeverity;
  status: BugStatus;
  rootCause: string;
  stepsToReproduce: string[];
  suggestedFix: string;
  markdown: string;
  rawInput: string;
  createdAt: string;
  sourceUrl?: string;
}

export interface DashboardMetrics {
  totalApiChecks: number;
  openBugs: number;
  inProgressBugs: number;
  resolvedBugs: number;
  avgResponseTimeMs: number;
  failingChecksCount: number;
}
