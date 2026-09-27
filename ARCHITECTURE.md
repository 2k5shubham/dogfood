# ARCHITECTURE.md

## System Overview

```
Browser
  │
  ▼
Next.js App Router (single process)
  ├── Server Components  → reads data, renders HTML
  ├── Route Handlers     → REST API (src/app/api/**/route.ts)
  └── Client Components  → interactive UI ('use client')
  │
  ▼
Data Access Layer (src/lib/*.dal.ts)
  │  ← All DB queries go through here
  │  ← judgeId ALWAYS bound from session here, never from request
  ▼
Prisma ORM (v5)
  │
  ▼
PostgreSQL 16
```

## Request → Response Flow

```
1. Request arrives at Next.js
2. middleware.ts reads session cookie → attaches user to request headers
3. Route Handler reads current user from cookie (server-side only)
4. Role check against event_roles table (per-event roles, not global)
5. DAL function called with userId from session
6. Prisma query executes with hardcoded WHERE clauses
7. Response serialized → client
```

## Authentication

- **No external auth service.** Custom session tokens stored as SHA-256 hashes in PostgreSQL.
- Tokens live in httpOnly cookies (not accessible to JavaScript).
- Sessions expire after 7 days.
- Password hashed with bcrypt (cost factor 12).

## Role System

Two-layer roles:

1. **Global role** (`users.global_role`): `user` | `admin`
2. **Per-event role** (`event_roles.role`): `organizer` | `judge` | `participant`

A user can be a judge in Event A and an organizer in Event B simultaneously. Role checks always query `event_roles` for the specific event.

## Judging Isolation Architecture

The most security-critical part of the system. Three layers of enforcement:

```
Layer 1 — Route Handler
  Check: getUserEventRole(userId, eventId) === 'judge'
  If organizer hits /api/.../scores → redirect to /summary endpoint

Layer 2 — Data Access Layer (judging.dal.ts)
  All score reads: WHERE judge_id = <session_user_id>
  judgeId ALWAYS from verified session, NEVER from URL params or body

Layer 3 — Database
  UNIQUE(judge_id, project_id, criterion_id) — prevents double-scoring
  FK constraints — score must reference valid assignment
```

## Docker Architecture

```
docker-compose.yml
├── db (postgres:16-alpine)
│     └── pgdata volume (persists between restarts)
└── app (node:20-alpine, multi-stage build)
      ├── prisma migrate deploy  (runs migrations)
      ├── node scripts/seed.js   (idempotent seeding)
      └── node server.js         (Next.js standalone server)
```

The `app` container waits for `db` to pass its health check before starting (using `depends_on: condition: service_healthy`).

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Next.js App Router | Full-stack in one codebase; server components handle auth without client round-trips |
| Custom JWT-free auth | No external deps; token stored as SHA-256 hash — if DB is compromised, raw tokens aren't exposed |
| Prisma v5 | Type-safe queries; schema-as-source-of-truth; migrations built-in |
| PostgreSQL | Window functions needed for Z-score; `GROUP BY` for progress aggregates; ACID transactions for vote credit deduction |
| Vanilla CSS | No build-time overhead; full design token control; no framework lock-in |
| Z-score normalization | Handles judge bias and scale differences; σ=0 edge case handled (contributes 0, not NaN) |
| Quadratic voting | Prevents vote concentration; forces honest preference revelation; well-studied mechanism |
| In-memory rate limiter | Sufficient for single-instance self-hosted deployment; no Redis dependency |

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           login, register, session
│   │   └── events/
│   │       ├── route.ts              list + create events
│   │       └── [eventId]/
│   │           ├── route.ts          get + patch event
│   │           ├── projects/         gallery + CRUD
│   │           ├── teams/            create + join via invite
│   │           ├── judges/           invite + assign
│   │           ├── rubric/           GET + PUT criteria
│   │           ├── scores/
│   │           │   ├── summary/      organizer aggregates + normalize
│   │           │   └── export/       CSV download
│   │           └── vote/
│   │               ├── request/      voter token issuance
│   │               └── cast/         quadratic vote + read
│   ├── judge/[eventId]/    judge scoring dashboard
│   ├── organizer/[eventId] organizer analytics dashboard
│   ├── vote/[eventId]/     community voting UI
│   ├── login/ register/    auth pages
│   └── globals.css         design system (tokens, components)
├── lib/
│   ├── auth.ts             session management
│   ├── prisma.ts           client singleton
│   ├── judging.dal.ts      isolated score queries + Z-score normalization
│   └── utils.ts            audit log, rate limiter, quadratic math
prisma/
│   └── schema.prisma       source of truth for all 14 tables
scripts/
│   └── seed.js             idempotent seed (fixtures + edge cases)
```
