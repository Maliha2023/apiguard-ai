import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 15000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanGeminiError(err: unknown): {
  status: number;
  message: string;
  retryable: boolean;
} {
  const statusFromErr =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : 500;
  const rawMessage = err instanceof Error ? err.message : String(err);

  try {
    const parsed = JSON.parse(rawMessage);
    const code = typeof parsed?.error?.code === 'number' ? parsed.error.code : statusFromErr;
    const apiMessage =
      typeof parsed?.error?.message === 'string'
        ? parsed.error.message
        : rawMessage;
    const retryable = code === 503 || code === 429;
    return {
      status: code >= 400 && code < 600 ? code : 500,
      message: retryable
        ? `${apiMessage} (HTTP ${code})`
        : apiMessage,
      retryable,
    };
  } catch {
    const retryable =
      statusFromErr === 503 ||
      statusFromErr === 429 ||
      rawMessage.includes('503') ||
      rawMessage.includes('UNAVAILABLE');
    return {
      status: statusFromErr >= 400 && statusFromErr < 600 ? statusFromErr : 500,
      message: rawMessage,
      retryable,
    };
  }
}

async function generateBugReport(ai: GoogleGenAI, rawLog: string) {
  return ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze the following raw error message, console log, or failed API response and convert it into a structured engineering bug report:\n\n---\n${rawLog}\n---`,
    config: {
      systemInstruction:
        'You are a senior site reliability and software quality engineer. Convert raw logs, stack traces, or failed HTTP responses into concise, accurate, actionable bug reports. Never invent unrelated stack frames; ground every claim in the provided input.',
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Concise, specific bug title summarizing the failure mode.',
          },
          severity: {
            type: Type.STRING,
            description: 'Exactly one of: Low, Medium, High, Critical.',
          },
          rootCause: {
            type: Type.STRING,
            description: 'Clear technical explanation of the underlying cause inferred from the error.',
          },
          stepsToReproduce: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Ordered 2-5 concrete steps to reproduce the issue.',
          },
          suggestedFix: {
            type: Type.STRING,
            description: 'Actionable remediation or code-level fix recommendation.',
          },
        },
        required: ['title', 'severity', 'rootCause', 'stepsToReproduce', 'suggestedFix'],
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/generate-bug-report', async (req, res) => {
    const rawLog = typeof req.body?.rawLog === 'string' ? req.body.rawLog.trim() : '';

    if (!rawLog) {
      res.status(400).json({ error: 'Please paste an error log, console trace, or failed API response.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to generate AI bug reports.',
      });
      return;
    }

    try {
      const response = await generateBugReport(ai, rawLog);

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        res.status(502).json({ error: 'Gemini returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawJson);
      res.json({ report: parsed });
    } catch (err) {
      const clean = extractCleanGeminiError(err);
      console.error('Error generating bug report:', clean.message);
      res.status(clean.status).json({ error: clean.message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`APIGuard AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
