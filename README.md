# GenAIGenesis — ContextBridge

**AI Workspaces with Efficient Memory — Context Tree**

A full-stack knowledge management platform that extracts structured context from workspace conversations, GitHub PRs, and sales records. The system uses AI-powered semantic search to answer questions, route to experts, and build a living knowledge tree per workspace.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Architectural Workflow](#architectural-workflow)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Overview

ContextBridge (branded as **numen**) enables teams to:

- **Ask questions** — Get AI-generated answers from workspace knowledge or route to the right expert
- **Build knowledge trees** — Automatically extract facts from chat messages, PRs, and sales records
- **Search by domain** — Engineering (GitHub PRs via Moorcheh), Sales, and General agents
- **Track analytics** — Interrupts saved, hours reclaimed, routed questions

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Clerk, Supabase JS |
| **Backend** | FastAPI, Python 3.12+, Uvicorn |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **AI** | Google Gemini (embeddings, extraction, Q&A) |
| **Search** | Moorcheh (vector search over PRs), pgvector (context tree) |
| **Auth** | Clerk (JWT verification) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                     │
│  Next.js App  │  Clerk Auth  │  Supabase Realtime  │  SSE (Bot Answers)          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (FastAPI)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │ REST API     │  │ Bot Pipeline │  │ Webhooks     │  │ Background Processor ││
│  │ (endpoints)  │  │ (SSE /ask)  │  │ (GitHub)     │  │ (message extraction) ││
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘│
│         │                 │                 │                     │              │
│         └─────────────────┼─────────────────┼─────────────────────┘              │
│                           ▼                 ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                         SERVICES LAYER                                        ││
│  │  ai.py  │  context_engine.py  │  bot_pipeline.py  │  moorcheh.py  │  supabase ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ Supabase (PostgreSQL) │  │ Google Gemini API      │  │ Moorcheh API           │
│ workspaces, agents,   │  │ Embeddings, extraction │  │ PR vector search      │
│ messages, tree_nodes  │  │ Q&A, classification   │  │                        │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## Architectural Workflow

### 1. Message → Context Extraction (Background)

```
User sends message in chat
        │
        ▼
┌───────────────────┐
│ messages table    │  (processed = false)
└────────┬──────────┘
         │
         ▼  Background processor polls every 10s
┌───────────────────┐
│ process_message() │
│ 1. Classify type  │  (engineering / sales / general)
│ 2. Extract facts  │  (Gemini)
│ 3. Upsert nodes   │  (tree_nodes + embeddings)
└───────────────────┘
```

### 2. Ask Pipeline (User asks a question)

```
User asks question via BotPanel
        │
        ▼
POST /api/ask (SSE stream)
        │
        ├─► Classify question (Gemini)
        │
        ├─► [Engineering?] Moorcheh PR search (fast path)
        │       └─► Sync PRs → Search → Return answer
        │
        └─► [Else] Context tree search
                │
                ├─► Generate embedding (Gemini)
                ├─► Cosine similarity over tree_nodes
                ├─► Staleness decay (confidence × e^(-days/14))
                │
                ├─► High confidence? → Generate answer (Gemini)
                ├─► Medium? → Answer with caveat
                └─► Low? → Route to expert (owner_id)
```

### 3. GitHub PR → Knowledge (Webhook)

```
GitHub PR event (opened/synchronize/closed)
        │
        ▼
POST /api/github (webhook)
        │
        ├─► Verify signature (HMAC-SHA256)
        ├─► Resolve workspace by repo full_name
        │
        ▼  Background task
┌───────────────────────────────┐
│ summarize_and_store_pr()      │
│ 1. Fetch diff (httpx)         │
│ 2. Summarize (Gemini)         │
│ 3. Upsert github_pull_requests│
│ 4. process_pr_into_context()  │  → tree_nodes
└───────────────────────────────┘
```

### 4. Data Model (Core Entities)

```
workspaces
    ├── workspace_members (user_id, role, display_name)
    ├── agents (type: engineering | sales | custom)
    │       └── tree_nodes (label, summary, embedding, parent_id)
    ├── messages (channel, content, processed)
    ├── questions (question_text, answer_text, was_routed)
    ├── github_pull_requests (pr_number, title, summary)
    ├── sales_records
    ├── onboarding_sessions
    └── analytics_daily
```

---

## Project Structure

```
GenAIGenesis/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, lifespan, background processor
│   ├── requirements.txt
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints.py    # REST: workspaces, agents, messages, tree, questions, sales, onboarding
│   │   │   ├── bot_endpoints.py # /ask (SSE), /respond, /bootstrap, /engineering/*
│   │   │   └── webhooks.py     # POST /github (GitHub webhook)
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic settings (env vars)
│   │   │   └── auth.py         # Clerk JWT verification (get_current_user_id)
│   │   └── services/
│   │       ├── ai.py           # Gemini: embeddings, extraction, classification, Q&A
│   │       ├── context_engine.py # process_message, upsert_tree_node, find_matching_nodes
│   │       ├── bot_pipeline.py  # ask_pipeline (SSE), handle_response
│   │       ├── moorcheh.py     # Moorcheh: sync PRs, engineering search
│   │       └── supabase.py     # Supabase client singleton
│   └── migrations/
│       ├── supabase_tables.sql
│       ├── github_pull_requests.sql
│       └── schema_updates.sql
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Landing (Globe, DiscordMockup)
│   │   ├── pricing/
│   │   ├── (auth)/
│   │   │   ├── signIn/[[...sign-in]]/
│   │   │   └── signUp/[[...sign-up]]/
│   │   ├── (dashboard)/
│   │   │   └── dashboard/
│   │   │       ├── page.tsx    # Dashboard landing
│   │   │       └── [slug]/     # Workspace view
│   │   └── components/
│   │       ├── WorkspaceView.tsx   # Main workspace layout
│   │       ├── Sidebar.tsx
│   │       ├── ChatArea.tsx        # Messages, realtime
│   │       ├── BotPanel.tsx        # Ask bot (SSE), traversal viz
│   │       ├── ContextTree.tsx
│   │       ├── ContextTreeVisual.tsx
│   │       ├── ContextTraversal.tsx
│   │       ├── CreateAgentModal.tsx
│   │       ├── PingNotification.tsx
│   │       ├── Globe.tsx / GlobeWrapper.tsx
│   │       ├── DiscordMockup.tsx
│   │       └── ScrollFade.tsx
│   ├── lib/
│   │   ├── api.ts              # apiFetch (auth'd backend calls)
│   │   └── supabase.ts        # Supabase client
│   ├── middleware.ts          # Clerk auth (protect routes)
│   ├── next.config.ts
│   └── package.json
│
└── README.md
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-agent workspaces** | Engineering, Sales, General agents with domain-specific extraction |
| **Context tree** | Hierarchical knowledge (domain → module) with vector embeddings |
| **Staleness decay** | Confidence decays over time: `effective = raw × e^(-days/14)` |
| **Moorcheh integration** | Vector search over GitHub PRs for engineering questions |
| **Expert routing** | Low-confidence questions routed to node owners |
| **GitHub webhooks** | Auto-ingest PRs, summarize, extract facts into tree |
| **Sales records** | Extract sales knowledge from raw text |
| **Onboarding** | Persona summary + expertise extraction for new members |
| **Realtime** | Supabase Realtime for messages and tree updates |

---

## API Reference

### REST (authenticated via `Authorization: Bearer <Clerk JWT>`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Current user + memberships |
| GET/POST | `/api/workspaces` | List / create workspaces |
| GET/PATCH/DELETE | `/api/workspaces/{id}` | Workspace CRUD |
| POST | `/api/workspace/join` | Join by slug |
| GET/POST | `/api/workspaces/{id}/members` | Members |
| GET/POST | `/api/workspaces/{id}/agents` | Agents |
| GET/POST | `/api/workspaces/{id}/messages` | Messages |
| GET | `/api/agents/{id}/tree` | Tree nodes |
| GET | `/api/agents/{id}/tree/all` | All nodes + staleness |
| GET/POST | `/api/workspaces/{id}/questions` | Questions |
| POST | `/api/respond/{question_id}` | Engineer responds |
| POST | `/api/workspaces/{id}/sales-records` | Sales records |
| POST | `/api/onboarding/{id}/complete` | Complete onboarding |
| POST | `/api/engineering/sync-prs` | Sync PRs to Moorcheh |

### Bot (SSE)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ask` | Ask question, stream SSE (status, traversal, result) |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/github` | GitHub `pull_request` webhook |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Supabase project
- Clerk application
- Google Gemini API key
- Moorcheh API key (optional, for engineering search)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env` (see [Environment Variables](#environment-variables)).

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk-publishable-key>
CLERK_SECRET_KEY=<clerk-secret-key>
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

Run migrations in Supabase SQL editor:

1. `backend/migrations/supabase_tables.sql`
2. `backend/migrations/github_pull_requests.sql`
3. `backend/migrations/schema_updates.sql`

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Yes | Anon key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable |
| `CLERK_JWKS_URL` | Yes | e.g. `https://<domain>.clerk.accounts.dev/.well-known/jwks.json` |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `MOORCHEH_API_KEY` | No | For engineering PR search |
| `GITHUB_WEBHOOK_SECRET` | No | For GitHub webhooks |
| `GITHUB_ACCESS_TOKEN` | No | For fetching PR diffs |
| `APP_BASE_URL` | No | Default `http://localhost:8000` |

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base (e.g. `http://localhost:8000/api`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable |
| `CLERK_SECRET_KEY` | Yes | Clerk secret |

---

## Deployment

### Backend (Railway, Render, etc.)

1. Set all backend env vars in the platform.
2. Set `APP_BASE_URL` to your deployed backend URL.
3. Add your frontend URL to CORS `allow_origins` in `main.py` if needed.

### Frontend (Vercel, etc.)

1. Set `NEXT_PUBLIC_API_URL` to your deployed backend URL + `/api`.
2. Configure Clerk redirect URLs for production.

### GitHub Webhook

1. Add webhook URL: `https://<backend>/api/github`
2. Select `pull_request` events.
3. Set `GITHUB_WEBHOOK_SECRET` in backend env.

---

## License

Proprietary. All rights reserved.
