# APIGuard AI

**Role-Based API Health Monitor & Intelligent Bug Triage System**

APIGuard AI is a dark-mode engineering workspace for probing HTTP endpoints, transforming raw error logs into structured bug reports with Gemini AI, and managing defect triage across **QA User** and **Admin Lead** roles—with zero external database setup required.

---

## Key Features

- **API Health Checker**
  - Probe live `GET` and `POST` endpoints, measure response latency in milliseconds, inspect color-coded HTTP status badges, and browse formatted JSON payloads.
  - Gracefully handles CORS restrictions or invalid URLs and includes a **Simulate 500 Server Error** action to test failure workflows and pass raw errors directly into the AI triage pipeline.
  - Persists check history automatically in browser `localStorage`.

- **AI Bug Report Generator**
  - Converts pasted error messages, stack traces, console logs, or failed API responses into structured Markdown bug reports (**Bug Title**, **Severity**, **Root Cause**, **Steps to Reproduce**, and **Suggested Fix**).
  - Routes all Gemini requests through a secure server-side Express endpoint (`POST /api/generate-bug-report`) using `process.env.GEMINI_API_KEY`—never exposing credentials to client-side code.
  - Supports **Copy Report** and **Save to Bug Tracker**.

- **Role-Based QA User & Admin Lead Dashboard**
  - **Role Switcher & Workspace Banners:** Switching roles updates header theming, displays a role-specific workspace banner, and automatically navigates to each role's primary view.
  - **QA User Mode:** Opens on **API Health Checker** with a blue workspace banner; allows testing APIs, generating bug reports, and logging/triaging bugs (`Open` / `In Progress`) while locking **Resolve** and **Delete** controls with *"Admin Only"* indicators.
  - **Admin Lead Mode:** Opens on **Bug & Test Tracker** with an **Admin Mode Active** badge, a purple workspace banner, full resolve/delete permissions, and an exclusive **Admin Control Panel** featuring team performance metrics, **Clear All Resolved Bugs**, and **Export Full Audit CSV**.

- **One-Click Demo Data**
  - Click **Load Demo Data** in the top header at any time to populate realistic API probe logs and bug records in one click.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite
- **Backend Proxy:** Express (`server.ts`) + `@google/genai` SDK
- **Persistence:** Browser `localStorage` (zero external database dependencies)
- **Testing:** Built-in `node:test` (`src/utils/bugLogic.test.ts`)

---

## Quick Start Guide

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and add your Gemini API key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="your-gemini-api-key"
```

> **Note:** `GEMINI_API_KEY` is read strictly on the server inside `server.ts` via `process.env.GEMINI_API_KEY` and is never bundled into client assets.

### 3. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Instant Evaluation (Recruiters & Reviewers)

1. Click **Load Demo Data** in the top-right header to populate sample API checks and bug reports immediately—no external API setup or database needed.
2. Use the **Role Switcher** (`QA User` | `Admin Lead`) in the header to compare restricted QA workflows against the **Admin Control Panel**, bulk **Clear All Resolved Bugs**, and **Export Full Audit CSV**.

### 5. Build & Run in Production

```bash
npm run build
npm start
```

### 6. Run Unit Tests & Typecheck

```bash
npx tsx --test src/utils/bugLogic.test.ts
npm run lint
```
