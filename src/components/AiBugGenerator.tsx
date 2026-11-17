import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Code2,
  Copy,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { BugReport, ParsedBugReport } from '../types';
import { buildStructuredBugReport } from '../utils/bugLogic';

interface AiBugGeneratorProps {
  initialRawError: string;
  initialSourceUrl?: string;
  onSaveBug: (bug: BugReport) => void;
  onGoToTracker: () => void;
}

const SAMPLE_ERRORS = [
  {
    label: '500 DB Pool Exhaustion',
    text: `POST https://api.payments.internal/v2/webhooks/stripe -> 500 Internal Server Error
Response Body:
{
  "error": "Internal Server Error",
  "code": "ECONNRESET_PG_POOL",
  "message": "TimeoutError: ResourceRequest timed out waiting for pg.Pool client after 10000ms",
  "traceId": "tr_88a12f0c"
}
Console stack:
at Pool.connect (/app/node_modules/pg-pool/index.js:214:11)
at verifyAndStoreWebhook (/app/src/routes/webhooks.ts:48:22)`,
  },
  {
    label: 'TypeError Null Reference',
    text: `Uncaught TypeError: Cannot read properties of undefined (reading 'billingAddress')
    at calculateTaxRate (checkoutService.ts:112:38)
    at async POST /api/v1/checkout/quote (checkoutController.ts:44:19)
Payload sent: { "cartId": "crt_902", "currency": "USD", "guestCheckout": true }`,
  },
];

export function AiBugGenerator({
  initialRawError,
  initialSourceUrl,
  onSaveBug,
  onGoToTracker,
}: AiBugGeneratorProps) {
  const [rawInput, setRawInput] = useState<string>(initialRawError);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<ParsedBugReport | null>(
    null
  );
  const [viewMarkdownSource, setViewMarkdownSource] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToTracker, setSavedToTracker] = useState<boolean>(false);

  useEffect(() => {
    if (initialRawError) {
      setRawInput(initialRawError);
      setSavedToTracker(false);
    }
  }, [initialRawError]);

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setErrorMessage(
        'Please paste a raw error message, console log, or failed API response first.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSavedToTracker(false);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 22000);

    try {
      const response = await fetch('/api/generate-bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawLog: trimmed }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || `Server responded with HTTP ${response.status}`
        );
      }

      const structured = buildStructuredBugReport(data.report ?? {});
      setGeneratedReport(structured);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorMessage(
          'Request timed out waiting for the Gemini API. Please try again.'
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to reach Gemini API endpoint.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!generatedReport) return;
    try {
      await navigator.clipboard.writeText(generatedReport.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission failures
    }
  };

  const handleSaveToTracker = () => {
    if (!generatedReport || savedToTracker) return;
    const newBug: BugReport = {
      id: `bug_${Date.now()}`,
      title: generatedReport.title,
      severity: generatedReport.severity,
      status: 'Open',
      rootCause: generatedReport.rootCause,
      stepsToReproduce: generatedReport.stepsToReproduce,
      suggestedFix: generatedReport.suggestedFix,
      markdown: generatedReport.markdown,
      rawInput: rawInput.trim(),
      createdAt: new Date().toISOString(),
      sourceUrl: initialSourceUrl,
    };
    onSaveBug(newBug);
    setSavedToTracker(true);
  };

  const severityStyle = (severity: ParsedBugReport['severity']) => {
    switch (severity) {
      case 'Critical':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'High':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'Medium':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Low':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <section className="xl:col-span-5 rounded-xl bg-[#111827] border border-slate-800/90 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            Raw Error Input
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Paste a stack trace, console log, or failed API response for Gemini analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {SAMPLE_ERRORS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setRawInput(sample.text);
                setErrorMessage(null);
                setSavedToTracker(false);
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-slate-700/70 transition-colors whitespace-nowrap"
            >
              Sample: {sample.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="raw-error-input" className="sr-only">
              Raw error message or log
            </label>
            <textarea
              id="raw-error-input"
              rows={12}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Paste error log, HTTP 500 JSON payload, or stack trace here..."
              className="w-full rounded-lg bg-[#0B0F17] border border-slate-700/90 p-3.5 text-xs font-mono leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg bg-rose-950/35 border border-rose-800/60 p-3 text-xs text-rose-200"
            >
              <AlertCircle
                className="h-4 w-4 text-rose-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex h-11 items-center justify-center gap-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Analyzing with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Generate Bug Report</span>
              </>
            )}
          </button>
        </form>
      </section>

      <section className="xl:col-span-7 rounded-xl bg-[#111827] border border-slate-800/90 overflow-hidden min-h-[360px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-slate-200">
              Structured Markdown Bug Report
            </h3>
          </div>

          {generatedReport && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMarkdownSource((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                {viewMarkdownSource ? (
                  <>
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Formatted View</span>
                  </>
                ) : (
                  <>
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Markdown Source</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy Report</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveToTracker}
                disabled={savedToTracker}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  savedToTracker
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {savedToTracker ? (
                  <>
                    <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Saved to Tracker</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save to Bug Tracker</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="space-y-4 animate-pulse" aria-label="Generating report">
              <div className="h-6 w-3/4 rounded bg-slate-800" />
              <div className="h-5 w-28 rounded bg-slate-800" />
              <div className="space-y-2 pt-2">
                <div className="h-4 w-32 rounded bg-slate-800" />
                <div className="h-16 w-full rounded bg-slate-800/80" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 w-40 rounded bg-slate-800" />
                <div className="h-20 w-full rounded bg-slate-800/80" />
              </div>
            </div>
          ) : generatedReport ? (
            viewMarkdownSource ? (
              <pre
                data-testid="markdown-report-source"
                className="overflow-auto rounded-lg bg-[#0B0F17] border border-slate-800 p-4 text-xs font-mono leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
              >
                {generatedReport.markdown}
              </pre>
            ) : (
              <article data-testid="structured-bug-report" className="space-y-5">
                <div className="space-y-2.5 pb-4 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-400">
                      Bug Title
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${severityStyle(
                        generatedReport.severity
                      )}`}
                    >
                      Severity: {generatedReport.severity}
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-semibold text-slate-100 leading-snug">
                    {generatedReport.title}
                  </h4>
                </div>

                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-1.5">
                    Root Cause
                  </h5>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {generatedReport.rootCause}
                  </p>
                </div>

                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-2">
                    Steps to Reproduce
                  </h5>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-300">
                    {generatedReport.stepsToReproduce.map((step, index) => (
                      <li key={index} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-1.5">
                    Suggested Fix
                  </h5>
                  <p className="text-sm leading-relaxed text-slate-200 bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5">
                    {generatedReport.suggestedFix}
                  </p>
                </div>

                {savedToTracker && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onGoToTracker}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <span>Open Bug & Test Tracker</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </article>
            )
          ) : (
            <div className="py-14 text-center max-w-md mx-auto">
              <p className="text-sm font-medium text-slate-300">
                No bug report generated yet
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Paste any console trace or failed HTTP response on the left and click
                &ldquo;Generate Bug Report&rdquo; to structure it with Gemini.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
