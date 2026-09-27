# DATA-MODEL.md

## Schema Overview

14 tables across 5 domains:

```
USERS & AUTH      users, sessions
EVENTS            events, tracks
ROLES             event_roles
TEAMS             teams, team_members
PROJECTS          projects
JUDGING           rubric_criteria, judge_assignments, judge_scores, score_cache, normalization_runs
VOTING            voter_tokens, project_votes
CONTENT           comments, audit_log
```

## Entity Relationship Summary

```
User ─── Session (1:N)
User ─── EventRole (1:N, per-event role)
User ─── TeamMember (1:N)

Event ─── Track (1:N)
Event ─── EventRole (1:N)
Event ─── Team (1:N)
Event ─── Project (1:N)
Event ─── RubricCriterion (1:N)
Event ─── JudgeAssignment (1:N)
Event ─── VoterToken (1:N)

Team ─── TeamMember (1:N)
Team ─── Project (1:1 per event — UNIQUE teamId+eventId)

Project ─── JudgeAssignment (1:N)
Project ─── JudgeScore (1:N)
Project ─── ScoreCache (1:1 per event)
Project ─── ProjectVote (1:N)
Project ─── Comment (1:N)

JudgeScore has UNIQUE(judge_id, project_id, criterion_id) — one score per judge/project/criterion
ProjectVote has UNIQUE(voter_token_id, project_id) — one vote record per voter/project
```

## Key Tables

### `judge_scores`
```sql
id            TEXT PRIMARY KEY
judge_id      TEXT NOT NULL  → users.id
project_id    TEXT NOT NULL  → projects.id
criterion_id  TEXT NOT NULL  → rubric_criteria.id
event_id      TEXT NOT NULL  → events.id
score         FLOAT NOT NULL
note          TEXT
created_at    TIMESTAMP
updated_at    TIMESTAMP

UNIQUE (judge_id, project_id, criterion_id)
```
> **Security note:** Every SELECT on this table in the application layer includes `WHERE judge_id = ?` bound from the authenticated session.

### `score_cache`
Stores the result of the most recent normalization run per project:
```sql
event_id          TEXT
project_id        TEXT
raw_weighted_avg  FLOAT   -- pre-normalization weighted average
normalized_score  FLOAT   -- Z-score normalized weighted score
judge_count       INT     -- how many judges scored this project
computed_at       TIMESTAMP

UNIQUE (event_id, project_id)
```

### `voter_tokens`
```sql
id             TEXT PRIMARY KEY
token_hash     TEXT UNIQUE   -- SHA-256 of the raw token (raw token never stored)
event_id       TEXT
email          TEXT
email_verified BOOLEAN
total_credits  INT DEFAULT 100
credits_used   INT DEFAULT 0
ip_address     TEXT
ballot_order   JSON  -- randomized array of project IDs for this voter
```

### `audit_log`
Append-only. Never deleted or updated.
```sql
id             TEXT PRIMARY KEY
user_id        TEXT  -- nullable (system actions)
action         TEXT  -- SCORE_SUBMIT, VOTE_CAST, etc.
entity_type    TEXT  -- judge_score, project, event, etc.
entity_id      TEXT
event_id       TEXT
old_value_json JSON
new_value_json JSON
ip_address     TEXT
created_at     TIMESTAMP
```

## Import / Export

### Importing Data

Seed script (`scripts/seed.js`) accepts the `fixtures.json` format. To import custom data:

```bash
# Copy your fixtures.json to the project root
# Then run seed inside the running container:
docker compose exec app node scripts/seed.js
```

### Exporting Scores (CSV)

```
GET /api/events/:eventId/scores/export
Authorization: organizer or admin session cookie
```

Returns CSV with columns: `Project, Team, Judge (anonymized), Criterion, Weight, Raw Score, Normalized Score, Rank`

### Exporting Full Data

```bash
# PostgreSQL dump
docker compose exec db pg_dump -U dogfood dogfood > backup.sql

# Restore
cat backup.sql | docker compose exec -T db psql -U dogfood dogfood
```

## Migration Path

### Into DOGFOOD
1. Export projects from old platform as CSV
2. Map to `projects` table schema
3. Import via `scripts/seed.js` (extend with custom import logic)

### Out of DOGFOOD
- Full PostgreSQL dump (standard SQL, no vendor lock-in)
- CSV score export via API
- All data is in plain PostgreSQL — portable to any platform
