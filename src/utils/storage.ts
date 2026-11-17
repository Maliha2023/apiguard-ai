import type { ApiCheckResult, BugReport, UserRole } from '../types';
import { formatBugReportMarkdown } from './bugLogic';

const API_CHECKS_KEY = 'bugpulse_api_checks_v1';
const BUGS_KEY = 'bugpulse_bugs_v1';
const ROLE_KEY = 'bugpulse_user_role_v1';

export function loadUserRole(): UserRole {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    return raw === 'Admin Lead' ? 'Admin Lead' : 'QA User';
  } catch {
    return 'QA User';
  }
}

export function saveUserRole(role: UserRole): void {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadApiChecks(): ApiCheckResult[] {
  try {
    const raw = localStorage.getItem(API_CHECKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveApiChecks(checks: ApiCheckResult[]): void {
  try {
    localStorage.setItem(API_CHECKS_KEY, JSON.stringify(checks.slice(0, 50)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadBugs(): BugReport[] {
  try {
    const raw = localStorage.getItem(BUGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBugs(bugs: BugReport[]): void {
  try {
    localStorage.setItem(BUGS_KEY, JSON.stringify(bugs));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function createDemoData(): { checks: ApiCheckResult[]; bugs: BugReport[] } {
  const now = Date.now();

  const checks: ApiCheckResult[] = [
    {
      id: 'demo_chk_1',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      status: 200,
      statusText: 'OK',
      responseTimeMs: 118,
      ok: true,
      responseBody: JSON.stringify(
        {
          userId: 1,
          id: 1,
          title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
          body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum',
        },
        null,
        2
      ),
      timestamp: new Date(now - 1000 * 60 * 4).toISOString(),
    },
    {
      id: 'demo_chk_2',
      method: 'POST',
      url: 'https://api.payments.internal/v2/webhooks/stripe',
      status: 500,
      statusText: 'Internal Server Error',
      responseTimeMs: 1842,
      ok: false,
      isSimulated: true,
      responseBody: JSON.stringify(
        {
          error: 'Internal Server Error',
          code: 'ECONNRESET_PG_POOL',
          message: 'Connection terminated unexpectedly while acquiring transaction lock',
          traceId: 'tr_94f81c20b',
        },
        null,
        2
      ),
      timestamp: new Date(now - 1000 * 60 * 18).toISOString(),
    },
    {
      id: 'demo_chk_3',
      method: 'GET',
      url: 'https://api.auth.internal/v1/sessions/verify',
      status: 401,
      statusText: 'Unauthorized',
      responseTimeMs: 74,
      ok: false,
      responseBody: JSON.stringify(
        {
          error: 'Unauthorized',
          message: 'JWT signature expired 320s ago',
        },
        null,
        2
      ),
      timestamp: new Date(now - 1000 * 60 * 47).toISOString(),
    },
    {
      id: 'demo_chk_4',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users/2',
      status: 200,
      statusText: 'OK',
      responseTimeMs: 96,
      ok: true,
      responseBody: JSON.stringify(
        {
          id: 2,
          name: 'Ervin Howell',
          username: 'Antonette',
          email: 'Shanna@melissa.tv',
        },
        null,
        2
      ),
      timestamp: new Date(now - 1000 * 60 * 95).toISOString(),
    },
  ];

  const bug1Fields = {
    title: 'Stripe Webhook Handler Throws 500 on Connection Pool Exhaustion',
    severity: 'Critical' as const,
    rootCause:
      'PostgreSQL client connections inside the webhook idempotency middleware are not released in a finally block when signature verification throws.',
    stepsToReproduce: [
      'Send 25 concurrent POST requests to /v2/webhooks/stripe with malformed Stripe-Signature headers.',
      'Observe connection pool saturation after the 20th request.',
      'Send a valid webhook payload and verify the endpoint returns HTTP 500 ECONNRESET_PG_POOL.',
    ],
    suggestedFix:
      'Wrap database client checkout in a try/finally block calling client.release(), and validate the webhook HMAC signature before acquiring a DB connection.',
  };

  const bug2Fields = {
    title: 'Session Verification Fails with 401 Without Refresh Token Rotation',
    severity: 'High' as const,
    rootCause:
      'Access tokens expire after 15 minutes and the client interceptor does not retry with the refresh endpoint before surfacing 401 Unauthorized.',
    stepsToReproduce: [
      'Authenticate a user session and wait 16 minutes.',
      'Trigger GET /v1/sessions/verify from the dashboard.',
      'Observe immediate 401 Unauthorized without silent token refresh.',
    ],
    suggestedFix:
      'Implement a single-flight refresh lock in the HTTP client interceptor to exchange the refresh token on 401 and replay the original request once.',
  };

  const bug3Fields = {
    title: 'JSON Response Viewer Clips Long Single-Line Stack Traces on Narrow Screens',
    severity: 'Low' as const,
    rootCause:
      'Preformatted response container lacked overflow-x-auto and break-words rules inside flex grid children.',
    stepsToReproduce: [
      'Open an error payload containing a 300-character stack trace line.',
      'Resize viewport to 390px mobile width.',
      'Observe horizontal clipping inside the parent panel.',
    ],
    suggestedFix:
      'Apply min-w-0 to flex/grid wrappers and overflow-x-auto to the <pre> code block container.',
  };

  const bugs: BugReport[] = [
    {
      id: 'demo_bug_1',
      ...bug1Fields,
      status: 'Open',
      markdown: formatBugReportMarkdown(bug1Fields),
      rawInput:
        'POST https://api.payments.internal/v2/webhooks/stripe -> 500 Internal Server Error (ECONNRESET_PG_POOL: Connection terminated unexpectedly while acquiring transaction lock)',
      createdAt: new Date(now - 1000 * 60 * 16).toISOString(),
      sourceUrl: 'https://api.payments.internal/v2/webhooks/stripe',
    },
    {
      id: 'demo_bug_2',
      ...bug2Fields,
      status: 'In Progress',
      markdown: formatBugReportMarkdown(bug2Fields),
      rawInput:
        'GET https://api.auth.internal/v1/sessions/verify -> 401 Unauthorized: JWT signature expired 320s ago',
      createdAt: new Date(now - 1000 * 60 * 44).toISOString(),
      sourceUrl: 'https://api.auth.internal/v1/sessions/verify',
    },
    {
      id: 'demo_bug_3',
      ...bug3Fields,
      status: 'Resolved',
      markdown: formatBugReportMarkdown(bug3Fields),
      rawInput:
        'CSS layout overflow detected in <pre> stack trace container at 390px viewport width.',
      createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
    },
  ];

  return { checks, bugs };
}
