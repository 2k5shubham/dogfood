# THREAT-MODEL.md

## Assets Being Protected

1. **Judge score confidentiality** — no judge should see another judge's scores
2. **Scoring integrity** — scores should not be tampered with after submission
3. **Vote integrity** — community votes should not be gamed
4. **Authentication** — sessions should not be stolen or forged
5. **Results integrity** — leaderboard should only be visible after `results_published_at`

---

## Threat 1: Score Tampering (Judge A reads/modifies Judge B's scores)

**Attack:** Judge A sends a request with Judge B's `project_id` and their own session token, hoping to read B's scores.

**Mitigation:**
- Every score query in `judging.dal.ts` is `WHERE judge_id = session_user_id` — the `judgeId` is **always** taken from the verified server-side session, never from URL params or request body.
- Even if Judge A knows Judge B's `userId`, they cannot use it in a query — the DAL ignores any client-supplied judge identity.
- All score writes are logged to the append-only `audit_log` with IP address.

**Residual risk:** Admin-level database access can see all scores. Mitigated by: admin accounts should be few, their actions are audit-logged, and the DB is not exposed externally in Docker setup.

---

## Threat 2: Judge Collusion (Two Judges Coordinate Scores)

**Attack:** Judge A tells Judge B their scores so they can coordinate rankings.

**Mitigation:**
- The API never returns another judge's scores — judges can only see their own.
- The organizer dashboard shows aggregated/normalized scores only — not per-judge breakdowns.
- Assignment randomization means judges don't know which other judges are reviewing the same project.
- Audit log records all score submissions with timestamps — systematic correlation patterns are detectable.

**Residual risk:** Out-of-band communication (email, Slack) cannot be technically prevented. Mitigated by the judging panel being from diverse organizations (Microsoft, Amazon, Meta, etc.) with reputational stakes.

---

## Threat 3: Vote Stuffing (Community Voting)

**Attack vector A:** Single person creates many voter tokens to cast unlimited votes.

**Mitigations:**
- Rate limit: 3 token requests per IP per 10 minutes
- Email required per token (duplicate email → same token)
- IP address recorded per token — unusual clusters detectable in audit log

**Attack vector B:** Script repeatedly changes votes to exhaust opponents' ballot budget.

**Mitigations:**
- Voter's own credit budget limits their total voting power (100 credits)
- Rate limit: 30 vote changes per minute per token
- All vote changes are audit-logged with timestamps

**Attack vector C:** Position bias — early-listed projects get more votes.

**Mitigation:** Ballot order is randomized per voter (stored in `voter_tokens.ballot_order` at token creation time, consistent within session).

---

## Threat 4: Session Hijacking

**Attack:** Steal a session token from a cookie.

**Mitigations:**
- Cookies are `httpOnly` — not accessible to JavaScript (XSS cannot steal them)
- Cookies are `sameSite: lax` — CSRF protected
- Token is stored in DB as SHA-256 hash — raw token never persisted, even if DB is compromised
- Sessions expire after 7 days
- Session table includes IP and user agent for anomaly detection

---

## Threat 5: Deadline Bypass

**Attack:** Submit a project or edit a submission after the deadline via direct API call.

**Mitigation:**
- Deadline check is in the route handler and DAL — not in the frontend
- `PUT /api/events/:id/projects/:id` returns 403 if `event.submission_deadline < now()`
- `POST .../submit` returns 403 if past deadline
- Cannot be bypassed by modifying frontend JavaScript

---

## Threat 6: Role Escalation

**Attack:** Participant calls a judge or organizer endpoint.

**Mitigation:**
- Every API route checks `getUserEventRole(userId, eventId)` before performing any action
- Role is read from the DB on every request — no client-controlled role claims
- Global admin role is set in DB by another admin only (no self-promotion endpoint)

---

## Threat 7: Results Leak During Judging/Voting Window

**Attack:** Call the leaderboard API before results are published.

**Mitigation:**
- `GET /api/events/:id/scores/summary` (organizer endpoint) returns `normalizedScore: null` for all projects when `resultsPublishedAt` is null or in the future
- The organizer can preview scores by toggling a client-side blur (scores are sent but visually hidden) — this is intentional for organizers, not public
- Public-facing leaderboard endpoint checks `resultsPublishedAt` before returning scores
