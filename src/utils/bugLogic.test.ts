import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuditCsv,
  buildStructuredBugReport,
  canChangeBugStatus,
  canDeleteBug,
  clearResolvedBugs,
  computeAdminPerformanceMetrics,
  computeDashboardMetrics,
  createSimulated500Result,
  formatJsonSafely,
  normalizeSeverity,
  validateEndpointUrl,
} from './bugLogic';
import type { ApiCheckResult, BugReport } from '../types';

test('validateEndpointUrl accepts valid http/https URLs and rejects empty or invalid ones', () => {
  assert.deepEqual(validateEndpointUrl(''), {
    valid: false,
    normalizedUrl: '',
    error: 'Please enter an endpoint URL before running a check.',
  });

  const ftp = validateEndpointUrl('ftp://example.com/file');
  assert.equal(ftp.valid, false);

  const malformed = validateEndpointUrl('not a url');
  assert.equal(malformed.valid, false);

  const valid = validateEndpointUrl('  https://jsonplaceholder.typicode.com/posts/1  ');
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedUrl, 'https://jsonplaceholder.typicode.com/posts/1');
});

test('formatJsonSafely pretty-prints valid JSON and falls back cleanly for plain text', () => {
  const jsonRes = formatJsonSafely('{"id":1,"title":"hello"}');
  assert.equal(jsonRes.isJson, true);
  assert.match(jsonRes.formatted, /"id": 1/);

  const textRes = formatJsonSafely('<html>502 Bad Gateway</html>');
  assert.equal(textRes.isJson, false);
  assert.equal(textRes.formatted, '<html>502 Bad Gateway</html>');
});

test('createSimulated500Result returns deterministic 500 error payload', () => {
  const fixedDate = new Date('2026-11-16T12:00:00.000Z');
  const sim = createSimulated500Result('POST', 'https://api.service.dev/checkout', fixedDate);
  assert.equal(sim.status, 500);
  assert.equal(sim.ok, false);
  assert.equal(sim.isSimulated, true);
  assert.equal(sim.method, 'POST');
  assert.match(sim.responseBody, /UPSTREAM_DEPENDENCY_TIMEOUT/);
});

test('normalizeSeverity maps arbitrary casing to standard enum values', () => {
  assert.equal(normalizeSeverity('CRITICAL'), 'Critical');
  assert.equal(normalizeSeverity('high priority'), 'High');
  assert.equal(normalizeSeverity('low'), 'Low');
  assert.equal(normalizeSeverity('unknown'), 'Medium');
});

test('buildStructuredBugReport produces clean Markdown with all required headings', () => {
  const report = buildStructuredBugReport({
    title: 'Checkout API returns 500 on empty cart',
    severity: 'High',
    rootCause: 'Null dereference when reading cart.items[0].sku.',
    stepsToReproduce: ['Send POST /api/checkout with empty items array', 'Observe HTTP 500'],
    suggestedFix: 'Guard against empty cart.items before indexing and return 400 Bad Request.',
  });

  assert.equal(report.severity, 'High');
  assert.match(report.markdown, /## Bug Title: Checkout API returns 500 on empty cart/);
  assert.match(report.markdown, /\*\*Severity:\*\* High/);
  assert.match(report.markdown, /### Root Cause/);
  assert.match(report.markdown, /1\. Send POST \/api\/checkout with empty items array/);
  assert.match(report.markdown, /### Suggested Fix/);
});

test('computeDashboardMetrics accurately aggregates API checks and bug statuses', () => {
  const checks: ApiCheckResult[] = [
    {
      id: '1',
      method: 'GET',
      url: 'https://example.com/ok',
      status: 200,
      statusText: 'OK',
      responseTimeMs: 100,
      ok: true,
      responseBody: '{}',
      timestamp: '2026-11-16T10:00:00Z',
    },
    {
      id: '2',
      method: 'POST',
      url: 'https://example.com/fail',
      status: 500,
      statusText: 'Internal Server Error',
      responseTimeMs: 300,
      ok: false,
      responseBody: '{}',
      timestamp: '2026-11-16T10:05:00Z',
    },
  ];

  const bugs: BugReport[] = [
    {
      id: 'b1',
      title: 'Bug 1',
      severity: 'High',
      status: 'Open',
      rootCause: 'Cause',
      stepsToReproduce: ['Step 1'],
      suggestedFix: 'Fix',
      markdown: 'md',
      rawInput: 'raw',
      createdAt: '2026-11-16T10:05:00Z',
    },
    {
      id: 'b2',
      title: 'Bug 2',
      severity: 'Low',
      status: 'Resolved',
      rootCause: 'Cause',
      stepsToReproduce: ['Step 1'],
      suggestedFix: 'Fix',
      markdown: 'md',
      rawInput: 'raw',
      createdAt: '2026-11-16T10:06:00Z',
    },
    {
      id: 'b3',
      title: 'Bug 3',
      severity: 'Medium',
      status: 'In Progress',
      rootCause: 'Cause',
      stepsToReproduce: ['Step 1'],
      suggestedFix: 'Fix',
      markdown: 'md',
      rawInput: 'raw',
      createdAt: '2026-11-16T10:07:00Z',
    },
  ];

  const metrics = computeDashboardMetrics(checks, bugs);
  assert.deepEqual(metrics, {
    totalApiChecks: 2,
    openBugs: 1,
    inProgressBugs: 1,
    resolvedBugs: 1,
    avgResponseTimeMs: 200,
    failingChecksCount: 1,
  });
});

test('role permissions enforce QA User vs Admin Lead rules', () => {
  assert.equal(canDeleteBug('QA User'), false);
  assert.equal(canDeleteBug('Admin Lead'), true);

  assert.equal(canChangeBugStatus('QA User', 'Open'), true);
  assert.equal(canChangeBugStatus('QA User', 'In Progress'), true);
  assert.equal(canChangeBugStatus('QA User', 'Resolved'), false);

  assert.equal(canChangeBugStatus('Admin Lead', 'Open'), true);
  assert.equal(canChangeBugStatus('Admin Lead', 'In Progress'), true);
  assert.equal(canChangeBugStatus('Admin Lead', 'Resolved'), true);
});

test('computeAdminPerformanceMetrics, clearResolvedBugs, and buildAuditCsv work accurately', () => {
  const checks: ApiCheckResult[] = [
    {
      id: '1',
      method: 'GET',
      url: 'https://example.com/1',
      status: 200,
      statusText: 'OK',
      responseTimeMs: 50,
      ok: true,
      responseBody: '{}',
      timestamp: '2026-11-16T10:00:00Z',
    },
    {
      id: '2',
      method: 'GET',
      url: 'https://example.com/2',
      status: 500,
      statusText: 'Internal Server Error',
      responseTimeMs: 500,
      ok: false,
      responseBody: '{}',
      timestamp: '2026-11-16T10:01:00Z',
    },
  ];
  const bugs: BugReport[] = [
    {
      id: 'b1',
      title: 'Critical "open" bug, needs fix',
      severity: 'Critical',
      status: 'Open',
      rootCause: 'Connection leak',
      stepsToReproduce: ['s'],
      suggestedFix: 'f',
      markdown: 'm',
      rawInput: 'r',
      createdAt: '2026-11-16T10:01:00Z',
    },
    {
      id: 'b2',
      title: 'Resolved high bug',
      severity: 'High',
      status: 'Resolved',
      rootCause: 'c',
      stepsToReproduce: ['s'],
      suggestedFix: 'f',
      markdown: 'm',
      rawInput: 'r',
      createdAt: '2026-11-16T10:02:00Z',
    },
  ];

  assert.deepEqual(computeAdminPerformanceMetrics(checks, bugs), {
    resolutionRatePct: 50,
    avgApiLatencyMs: 275,
    highPriorityOpenCount: 1,
    awaitingResolutionCount: 1,
    failingCheckRatePct: 50,
    totalTrackedRecords: 4,
  });

  const remaining = clearResolvedBugs(bugs);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'b1');

  const csv = buildAuditCsv(checks, bugs);
  assert.match(csv, /^RecordType,ID,Timestamp/);
  assert.match(csv, /BUG_REPORT,b1,2026-11-16T10:01:00Z,"Critical ""open"" bug, needs fix"/);
  assert.match(csv, /API_CHECK,2,2026-11-16T10:01:00Z,GET,https:\/\/example\.com\/2,500 Internal Server Error,500,OK/);
});
