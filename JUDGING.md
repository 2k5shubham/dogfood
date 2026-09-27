# JUDGING.md — Assignment, Scoring, Normalization

## 1. Judge Assignment

**Algorithm:** Round-robin distribution.

```
For each project i (0-indexed), assign judges at positions:
  judge_indices = [(i + r) % total_judges  for r in range(reviews_per_project)]

Default: reviews_per_project = 3
```

This ensures:
- Each project receives exactly `reviews_per_project` distinct judges
- Judge load is balanced (each judge reviews approximately the same number of projects)
- No project can be assigned to the same judge twice (deduplicated)

Assignment is triggered by the organizer via `POST /api/events/:id/judges` with `{ action: "assign" }`.

---

## 2. Scoring Rubric

Organizers define criteria before judging opens:

```json
[
  { "name": "Innovation",      "weight": 0.25, "maxScore": 5 },
  { "name": "Technical Depth", "weight": 0.30, "maxScore": 5 },
  { "name": "Impact",          "weight": 0.25, "maxScore": 5 },
  { "name": "Presentation",    "weight": 0.20, "maxScore": 5 }
]
```

**Constraint:** `Σ weights = 1.0` — enforced by the API (returns 400 if violated).

---

## 3. Score Normalization — Z-Score Method

### Why Z-Score?

Raw scores cannot be aggregated fairly when judges use different scales:
- Judge A scores everything 4–5 (lenient)
- Judge B scores everything 1–3 (harsh)
- Judge C scores everything exactly 3.0 (uniform — no discriminating information)

Z-score normalization removes per-judge mean and scale bias, making scores comparable across judges.

### Algorithm

**Step 1: Compute per-judge, per-criterion statistics**

For each judge `j` and criterion `k`, compute over all projects that judge scored:

```
μ_jk = (1/N) × Σ s_ijk            # judge j's mean score on criterion k
σ_jk = sqrt((1/N) × Σ (s_ijk - μ_jk)²)  # standard deviation
```

**Step 2: Compute z-scores**

```
If σ_jk > 0:  z_ijk = (s_ijk - μ_jk) / σ_jk
If σ_jk = 0:  z_ijk = 0     ← edge case: uniform judge contributes zero information
```

The `σ=0` case occurs when a judge assigns the same score to every project on a criterion. This judge is excluded from that criterion's aggregate (rather than crashing with NaN or infinity), which is the correct behavior: a uniform scorer provides no relative ranking information.

**Step 3: Average z-scores per project per criterion**

For each project `i` and criterion `k`:
```
z̄_ik = (1/|J_i|) × Σ_j z_ijk     # mean z-score across all assigned judges J_i
```

**Step 4: Compute weighted final score**

```
final_score_i = Σ_k (w_k × z̄_ik)

where Σ_k w_k = 1.0  (rubric constraint)
```

### Worked Example

| Judge | Project A | Project B | Project C | μ | σ |
|---|---|---|---|---|---|
| Alice | 4.0 | 2.0 | 3.0 | 3.0 | 0.816 |
| Bob   | 5.0 | 3.0 | 4.0 | 4.0 | 0.816 |
| Carol | 3.0 | 3.0 | 3.0 | 3.0 | **0.0** ← uniform |

Z-scores (σ=0 → z=0 for Carol):

| Judge | Project A | Project B | Project C |
|---|---|---|---|
| Alice | +1.22 | -1.22 | 0.0 |
| Bob   | +1.22 | -1.22 | 0.0 |
| Carol | 0.0   | 0.0   | 0.0 |

Mean z-scores: A=+0.816, B=-0.816, C=0.0

**Result: Project A ranked 1st, Project B ranked last — correct, despite different raw score scales.**

### Normalization Proof (Bias Elimination)

Let judge j have a systematic additive bias `b_j` (e.g., always scores 1 point higher).

Raw score: `s_ijk = true_ijk + b_j`

After Z-score:
```
z_ijk = (s_ijk - μ_jk) / σ_jk
      = ((true_ijk + b_j) - (μ_true_jk + b_j)) / σ_jk
      = (true_ijk - μ_true_jk) / σ_jk
```

The bias `b_j` cancels out. Z-score normalization is **unbiased under additive judge-level shifts**. ✓

Similarly for multiplicative scale bias `s_ijk = c_j × true_ijk`:
```
z_ijk = (c_j × true_ijk - c_j × μ_true_jk) / (c_j × σ_true_jk)
      = (true_ijk - μ_true_jk) / σ_true_jk
```

Scale factor `c_j` also cancels. ✓

---

## 4. Role Isolation — How It Works

Every score query in the data access layer is hardcoded with the authenticated judge's ID:

```typescript
// judging.dal.ts
export async function getMyScoresForProject(judgeId: string, projectId: string) {
  return prisma.judgeScore.findMany({
    where: { judgeId, projectId },  // ← judgeId from session, always
  })
}
```

The `judgeId` parameter **always comes from the verified session** (server-side cookie check), never from the URL or request body.

**Test isolation with curl:**
```bash
# As Judge A — returns only Judge A's scores
curl -H "Cookie: dogfood_session=<judge_a_token>" \
  http://localhost:3000/api/events/EVENT_ID/projects/PROJECT_ID/scores

# As Judge B — returns only Judge B's scores (different data)
curl -H "Cookie: dogfood_session=<judge_b_token>" \
  http://localhost:3000/api/events/EVENT_ID/projects/PROJECT_ID/scores

# No token — returns 401
curl http://localhost:3000/api/events/EVENT_ID/projects/PROJECT_ID/scores
```

Organizers have a separate endpoint (`/api/events/:id/scores/summary`) that returns **aggregated data only** — never per-judge raw rows.

---

## 5. Audit Trail

Every score write, role change, and vote cast is logged to the `audit_log` table:

```
action           | entity_type   | description
-----------------|---------------|----------------------------------
SCORE_SUBMIT     | judge_score   | Judge submitted/updated a score
ASSIGNMENT_COMPLETE | judge_assignment | Judge marked project complete
JUDGE_INVITE     | event_role    | Organizer invited a judge
JUDGES_ASSIGNED  | event         | Round-robin assignment triggered
NORMALIZATION_RUN | event        | Z-score normalization ran
PROJECT_SUBMIT   | project       | Team submitted a project
VOTE_CAST        | project_vote  | Community vote cast
EVENT_CREATE     | event         | New event created
EVENT_UPDATE     | event         | Event settings changed
```

The audit log is **append-only** — rows are never deleted or updated. Each row includes `user_id`, `ip_address`, `old_value_json`, `new_value_json`, and `created_at`.

---

## 6. Community Voting — Quadratic Model

Each voter receives 100 credits. Casting `k` votes for a project costs `k²` credits.

| Votes (k) | Cost (k²) | Marginal cost |
|---|---|---|
| 1 | 1 | 1 |
| 2 | 4 | 3 |
| 3 | 9 | 5 |
| 5 | 25 | 9 |
| 10 | 100 | 19 |

**Why quadratic?** It forces voters to reveal genuine preference intensity — expressing strong support for one project is expensive, encouraging honest allocation across multiple projects they care about. A voter cannot "whale" a single project without exhausting their entire budget.

Anti-abuse measures:
- Rate limit: 30 vote changes per minute per token
- Email-gated voter tokens (email verified before token is issued)
- IP address logged per token
- Ballot order randomized per voter (kills position bias)
- Results hidden from public until `voting_deadline` passes — even via API
- Full audit trail in `audit_log`
