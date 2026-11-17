import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ApiCheckResult, HttpMethod } from '../types';
import {
  createSimulated500Result,
  formatJsonSafely,
  formatRelativeTimestamp,
  validateEndpointUrl,
} from '../utils/bugLogic';

interface ApiHealthCheckerProps {
  checks: ApiCheckResult[];
  onRecordCheck: (result: ApiCheckResult) => void;
  onClearHistory: () => void;
  onSendErrorToAi: (rawErrorText: string, sourceUrl?: string) => void;
}

const DEFAULT_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts/1';
const DEFAULT_POST_BODY = JSON.stringify(
  {
    title: 'APIGuard automated health probe',
    body: 'Verifying POST endpoint latency and JSON contract.',
    userId: 1,
  },
  null,
  2
);

export function ApiHealthChecker({
  checks,
  onRecordCheck,
  onClearHistory,
  onSendErrorToAi,
}: ApiHealthCheckerProps) {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState<string>(DEFAULT_ENDPOINT);
  const [postBody, setPostBody] = useState<string>(DEFAULT_POST_BODY);
  const [loading, setLoading] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<ApiCheckResult | null>(
    checks[0] ?? null
  );
  const [requestFailure, setRequestFailure] = useState<{
    message: string;
    url: string;
    method: HttpMethod;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runCheck = async (targetMethod: HttpMethod, targetUrl: string) => {
    const validation = validateEndpointUrl(targetUrl);
    if (!validation.valid) {
      setRequestFailure({
        message: validation.error ?? 'Invalid endpoint URL.',
        url: targetUrl,
        method: targetMethod,
      });
      setLatestResult(null);
      return;
    }

    setLoading(true);
    setRequestFailure(null);

    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const fetchOptions: RequestInit = {
        method: targetMethod,
        signal: controller.signal,
        headers:
          targetMethod === 'POST'
            ? { 'Content-Type': 'application/json' }
            : undefined,
        body: targetMethod === 'POST' ? postBody : undefined,
      };

      const response = await fetch(validation.normalizedUrl, fetchOptions);
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      const rawText = await response.text();
      const { formatted } = formatJsonSafely(rawText);

      const result: ApiCheckResult = {
        id: `chk_${Date.now()}`,
        method: targetMethod,
        url: validation.normalizedUrl,
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        responseTimeMs: elapsedMs,
        ok: response.ok,
        responseBody: formatted,
        timestamp: new Date().toISOString(),
      };

      setLatestResult(result);
      onRecordCheck(result);
    } catch (err) {
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      const errorMessage =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Request timed out after 12,000 ms.'
          : err instanceof Error
            ? `${err.message} (Likely caused by CORS policy, DNS failure, or unreachable endpoint)`
            : 'Network request failed due to CORS or unreachable host.';

      const failedResult: ApiCheckResult = {
        id: `chk_err_${Date.now()}`,
        method: targetMethod,
        url: validation.normalizedUrl,
        status: 0,
        statusText: 'Network / CORS Error',
        responseTimeMs: elapsedMs,
        ok: false,
        responseBody: JSON.stringify(
          {
            error: 'FetchFailed',
            message: errorMessage,
            endpoint: validation.normalizedUrl,
            method: targetMethod,
          },
          null,
          2
        ),
        errorMessage,
        timestamp: new Date().toISOString(),
      };

      setLatestResult(failedResult);
      setRequestFailure({
        message: errorMessage,
        url: validation.normalizedUrl,
        method: targetMethod,
      });
      onRecordCheck(failedResult);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runCheck(method, url);
  };

  const handleSimulate500 = () => {
    const targetUrl = requestFailure?.url || url || DEFAULT_ENDPOINT;
    const targetMethod = requestFailure?.method || method;
    const simulated = createSimulated500Result(targetMethod, targetUrl);
    setRequestFailure(null);
    setLatestResult(simulated);
    onRecordCheck(simulated);
  };

  const handleCopyJson = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleSendToGenerator = (result: ApiCheckResult) => {
    const payload = [
      `HTTP ${result.status || 'NETWORK_ERROR'} ${result.statusText}`,
      `Endpoint: ${result.method} ${result.url}`,
      `Response Time: ${result.responseTimeMs} ms`,
      `Timestamp: ${result.timestamp}`,
      '',
      'Response Body:',
      result.responseBody,
    ].join('\n');
    onSendErrorToAi(payload, result.url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[#111827] border border-slate-800/90 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Endpoint Probe
            </h2>
            <p className="text-sm text-slate-400">
              Test live HTTP endpoints, inspect JSON payloads, and measure latency.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('GET');
                setUrl('https://jsonplaceholder.typicode.com/posts/1');
                setRequestFailure(null);
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-slate-700/70 transition-colors whitespace-nowrap"
            >
              Sample: Valid JSON
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('GET');
                setUrl('https://invalid-endpoint-cors-check.local/api/v1/orders');
                setRequestFailure(null);
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-slate-700/70 transition-colors whitespace-nowrap"
            >
              Sample: Failed URL
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="md:w-32 shrink-0">
              <label htmlFor="http-method" className="sr-only">
                HTTP Method
              </label>
              <select
                id="http-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full h-11 px-3 rounded-lg bg-[#0B0F17] border border-slate-700/90 text-sm font-mono font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            <div className="flex-1 min-w-0">
              <label htmlFor="endpoint-url" className="sr-only">
                Endpoint URL
              </label>
              <input
                id="endpoint-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jsonplaceholder.typicode.com/posts/1"
                className="w-full h-11 px-3.5 rounded-lg bg-[#0B0F17] border border-slate-700/90 text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Test API</span>
                </>
              )}
            </button>
          </div>

          {method === 'POST' && (
            <div>
              <label
                htmlFor="post-json-body"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                JSON Request Body
              </label>
              <textarea
                id="post-json-body"
                rows={4}
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                className="w-full rounded-lg bg-[#0B0F17] border border-slate-700/90 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </form>

        {requestFailure && (
          <div
            role="alert"
            className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-rose-950/30 border border-rose-800/60 p-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <ShieldAlert
                className="h-5 w-5 text-rose-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-200">
                  Request could not complete
                </p>
                <p className="text-xs text-rose-300/90 mt-0.5 break-words">
                  {requestFailure.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSimulate500}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simulate 500 Server Error</span>
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/90">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <h3 className="text-sm font-semibold text-slate-200">
              Response Inspector
            </h3>
            {latestResult && (
              <>
                <span
                  data-testid="http-status-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold whitespace-nowrap ${
                    latestResult.ok
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {latestResult.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {latestResult.status > 0
                      ? `${latestResult.status} ${latestResult.statusText}`
                      : latestResult.statusText}
                  </span>
                </span>

                <span
                  data-testid="response-time-ms"
                  className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-300"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>{latestResult.responseTimeMs} ms</span>
                </span>

                {latestResult.isSimulated && (
                  <span className="text-xs text-amber-300 font-medium">
                    Simulated payload
                  </span>
                )}
              </>
            )}
          </div>

          {latestResult && (
            <div className="flex items-center gap-2">
              {!latestResult.ok && (
                <button
                  type="button"
                  onClick={() => handleSendToGenerator(latestResult)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-xs font-medium text-blue-300 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Generate AI Bug Report</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  void handleCopyJson(latestResult.responseBody, 'latest')
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                {copiedId === 'latest' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-5">
          {latestResult ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="font-semibold text-slate-200">
                  {latestResult.method}
                </span>
                <span aria-hidden="true">·</span>
                <span className="break-all">{latestResult.url}</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelativeTimestamp(latestResult.timestamp)}</span>
              </div>
              <pre
                data-testid="json-response-viewer"
                className="max-h-80 overflow-auto rounded-lg bg-[#0B0F17] border border-slate-800 p-4 text-xs font-mono leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
              >
                {latestResult.responseBody}
              </pre>
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-300 font-medium">
                Ready to inspect an endpoint
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click &ldquo;Test API&rdquo; above to measure latency and view the formatted response.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-[#111827] border border-slate-800/90 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/90">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Recent API Check History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved automatically to localStorage ({checks.length} recorded)
            </p>
          </div>
          {checks.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {checks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No API checks recorded yet. Run a probe above to start logging history.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {checks.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-semibold text-slate-300 w-11 shrink-0">
                    {item.method}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono tabular-nums text-xs font-semibold w-16 shrink-0 ${
                      item.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{item.status > 0 ? item.status : 'ERR'}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-300 truncate">
                    {item.url}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <span className="font-mono tabular-nums text-xs text-slate-400">
                    {item.responseTimeMs} ms
                  </span>
                  <span className="text-xs text-slate-500 w-16 text-right">
                    {formatRelativeTimestamp(item.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod(item.method);
                      setUrl(item.url);
                      setLatestResult(item);
                      setRequestFailure(null);
                    }}
                    aria-label={`Inspect check ${item.method} ${item.url}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Inspect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
