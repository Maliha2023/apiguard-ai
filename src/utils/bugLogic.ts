import type {
  ApiCheckResult,
  BugReport,
  BugSeverity,
  BugStatus,
  DashboardMetrics,
  HttpMethod,
  ParsedBugReport,
  UserRole,
} from '../types';

export function validateEndpointUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Please enter an endpoint URL before running a check.',
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: trimmed,
        error: 'Only HTTP and HTTPS protocols are supported.',
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error: 'Invalid URL format. Include https:// or http:// (e.g. https://jsonplaceholder.typicode.com/posts/1).',
    };
  }
}

export function formatJsonSafely(rawText: string): {
  formatted: string;
  isJson: boolean;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { formatted: '(Empty response body)', isJson: false };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isJson: true,
    };
  } catch {
    return {
      formatted: rawText,
      isJson: false,
    };
  }
}

export function createSimulated500Result(
  method: HttpMethod,
  url: string,
  now: Date = new Date()
): ApiCheckResult {
  const errorPayload = {
    error: 'Internal Server Error',
    status: 500,
    code: 'UPSTREAM_DEPENDENCY_TIMEOUT',
    message:
      'Unhandled database connection pool exhaustion while processing upstream API request.',
    method,
    endpoint: url || 'https://api.example.com/v1/resource',
    traceId: `tr_${Math.abs(hashString(url + now.toISOString())).toString(16).slice(0, 10)}`,
    timestamp: now.toISOString(),
  };

  return {
    id: `chk_sim_${now.getTime()}`,
    method,
    url: url.trim() || 'https://api.example.com/v1/resource',
    status: 500,
    statusText: 'Internal Server Error',
    responseTimeMs: 1482,
    ok: false,
    isSimulated: true,
    responseBody: JSON.stringify(errorPayload, null, 2),
    timestamp: now.toISOString(),
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function normalizeSeverity(value: string | undefined): BugSeverity {
  const lower = (value ?? '').trim().toLowerCase();
  if (lower.includes('critical')) return 'Critical';
  if (lower.includes('high')) return 'High';
  if (lower.includes('low')) return 'Low';
  return 'Medium';
}

export function formatBugReportMarkdown(report: Omit<ParsedBugReport, 'markdown'>): string {
  const steps =
    report.stepsToReproduce.length > 0
      ? report.stepsToReproduce.map((step, index) => `${index + 1}. ${step}`).join('\n')
      : '1. Trigger the failing request or workflow with the recorded payload.';

  return [
    `## Bug Title: ${report.title}`,
    '',
    `**Severity:** ${report.severity}`,
    '',
    `### Root Cause`,
    report.rootCause,
    '',
    `### Steps to Reproduce`,
    steps,
    '',
    `### Suggested Fix`,
    report.suggestedFix,
  ].join('\n');
}

export function buildStructuredBugReport(input: {
  title?: string;
  severity?: string;
  rootCause?: string;
  stepsToReproduce?: string[];
  suggestedFix?: string;
}): ParsedBugReport {
  const title = (input.title ?? '').trim() || 'Unhandled API / Runtime Failure';
  const severity = normalizeSeverity(input.severity);
  const rootCause =
    (input.rootCause ?? '').trim() ||
    'The upstream operation failed without a fallback error boundary or retry policy.';
  const stepsToReproduce = (input.stepsToReproduce ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const suggestedFix =
    (input.suggestedFix ?? '').trim() ||
    'Add structured error handling, validate input contracts, and inspect server logs for the failing trace.';

  const structured: Omit<ParsedBugReport, 'markdown'> = {
    title,
    severity,
    rootCause,
    stepsToReproduce:
      stepsToReproduce.length > 0
        ? stepsToReproduce
        : ['Execute the failing endpoint or code path with the captured input.'],
    suggestedFix,
  };

  return {
    ...structured,
    markdown: formatBugReportMarkdown(structured),
  };
}

export function computeDashboardMetrics(
  checks: ApiCheckResult[],
  bugs: BugReport[]
): DashboardMetrics {
  const totalApiChecks = checks.length;
  const openBugs = bugs.filter((b) => b.status === 'Open').length;
  const inProgressBugs = bugs.filter((b) => b.status === 'In Progress').length;
  const resolvedBugs = bugs.filter((b) => b.status === 'Resolved').length;

  const avgResponseTimeMs =
    totalApiChecks > 0
      ? Math.round(checks.reduce((acc, item) => acc + item.responseTimeMs, 0) / totalApiChecks)
      : 0;

  const failingChecksCount = checks.filter((c) => !c.ok || c.status >= 400 || c.status === 0).length;

  return {
    totalApiChecks,
    openBugs,
    inProgressBugs,
    resolvedBugs,
    avgResponseTimeMs,
    failingChecksCount,
  };
}

export function formatRelativeTimestamp(isoTimestamp: string, now: Date = new Date()): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSeconds < 5) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function canDeleteBug(role: UserRole): boolean {
  return role === 'Admin Lead';
}

export function canChangeBugStatus(role: UserRole, nextStatus: BugStatus): boolean {
  if (role === 'Admin Lead') return true;
  return nextStatus !== 'Resolved';
}

export function clearResolvedBugs(bugs: BugReport[]): BugReport[] {
  return bugs.filter((b) => b.status !== 'Resolved');
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAuditCsv(
  checks: ApiCheckResult[],
  bugs: BugReport[]
): string {
  const header = [
    'RecordType',
    'ID',
    'Timestamp',
    'TitleOrMethod',
    'EndpointOrSeverity',
    'Status',
    'LatencyMs',
    'Details',
  ].join(',');

  const bugRows = bugs.map((bug) =>
    [
      'BUG_REPORT',
      bug.id,
      bug.createdAt,
      bug.title,
      bug.severity,
      bug.status,
      '',
      bug.rootCause,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const checkRows = checks.map((chk) =>
    [
      'API_CHECK',
      chk.id,
      chk.timestamp,
      chk.method,
      chk.url,
      chk.status > 0 ? `${chk.status} ${chk.statusText}` : chk.statusText,
      chk.responseTimeMs,
      chk.isSimulated ? 'Simulated 500 error' : chk.errorMessage ?? 'OK',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [header, ...bugRows, ...checkRows].join('\n');
}

export function computeAdminPerformanceMetrics(
  checks: ApiCheckResult[],
  bugs: BugReport[]
): {
  resolutionRatePct: number;
  avgApiLatencyMs: number;
  highPriorityOpenCount: number;
  awaitingResolutionCount: number;
  failingCheckRatePct: number;
  totalTrackedRecords: number;
} {
  const resolvedCount = bugs.filter((b) => b.status === 'Resolved').length;
  const resolutionRatePct =
    bugs.length > 0 ? Math.round((resolvedCount / bugs.length) * 100) : 0;

  const avgApiLatencyMs =
    checks.length > 0
      ? Math.round(
          checks.reduce((acc, item) => acc + item.responseTimeMs, 0) /
            checks.length
        )
      : 0;

  const highPriorityOpenCount = bugs.filter(
    (b) =>
      b.status !== 'Resolved' &&
      (b.severity === 'Critical' || b.severity === 'High')
  ).length;
  const awaitingResolutionCount = bugs.filter(
    (b) => b.status !== 'Resolved'
  ).length;
  const failingChecks = checks.filter(
    (c) => !c.ok || c.status >= 400 || c.status === 0
  ).length;
  const failingCheckRatePct =
    checks.length > 0 ? Math.round((failingChecks / checks.length) * 100) : 0;

  return {
    resolutionRatePct,
    avgApiLatencyMs,
    highPriorityOpenCount,
    awaitingResolutionCount,
    failingCheckRatePct,
    totalTrackedRecords: checks.length + bugs.length,
  };
}
