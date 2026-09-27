# DOGFOOD Platform

A modern, open-source, self-hostable hackathon submission and judging platform.

## One-Command Startup

```bash
git clone <your-repo>
cd your-portal
docker compose up
```

App runs at **http://localhost:3000**

**Default accounts (seeded automatically):**

| Role | Email | Password |
|---|---|---|
| Admin | admin@dogfood.dev | password123 |
| Organizer | organizer@dogfood.dev | password123 |
| Judges | judge1-5@dogfood.dev | password123 |
| Teams | team1-6@dogfood.dev | password123 |

## What It Does

- **T1 — Core**: Auth (5 roles), event creation with tracks, team formation via invite link, project submission with deadline enforcement, public gallery with search/filter
- **T2 — Judging**: Judge invitation/batch import, weighted rubric builder, backend-enforced score isolation, round-robin assignment, Z-score normalization, organizer live dashboard, CSV export
- **T3 — Community**: Quadratic voting (k votes costs k² credits), randomized ballot ordering, rate limiting, email-gated voter tokens, audit trail

## Requirements

- Docker + Docker Compose — that's it. No cloud, no external auth, runs fully offline.

## Key Security Properties

- Judge scores are **never exposed cross-judge** — every query in the DAL is `WHERE judge_id = session_user_id`
- All score writes are audit-logged to an append-only table
- Deadline enforcement is in the API layer, not the frontend (survives `curl`)
- Role checks are in the backend — test with: `curl -X POST /api/events/:id/scores` (no token → 401)

## Architecture / Judging / Data Model

See [ARCHITECTURE.md](./ARCHITECTURE.md), [JUDGING.md](./JUDGING.md), [DATA-MODEL.md](./DATA-MODEL.md)

## Honest Limits

- Email delivery: voter tokens and judge invite URLs are logged to stdout in self-hosted mode (`docker compose logs app`)
- T4 REST API / webhooks: not implemented
- Certificate generation: not implemented

## License

MIT
