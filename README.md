# DOGFOOD Platform ⚡

A modern, production-ready, self-hostable hackathon submission, judging, and community voting platform that judges itself.

Built with **Next.js 16 (App Router)**, **PostgreSQL 16**, **Prisma ORM**, and **Docker Compose**.

---

## 🐳 Running with Docker (Recommended)

The entire platform is fully containerized and can be launched with a single Docker Compose command. It automatically provisions the PostgreSQL database, executes database schema synchronization, seeds default accounts and hackathon events, and starts the Next.js production server.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Docker Compose v2+ installed and running.

---

### Quickstart

1. **Clone the repository:**
   ```bash
   git clone https://github.com/2k5shubham/dogfood.git
   cd dogfood
   ```

2. **(Optional) Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Note: If no `.env` is provided, Docker Compose uses sensible offline development defaults automatically.*

3. **Start the Docker Compose stack:**
   ```bash
   docker compose up --build -d
   ```

4. **Access the application:**
   - **Web UI & API**: [http://localhost:3000](http://localhost:3000)
   - **PostgreSQL Database**: `localhost:5432` (`user: dogfood`, `password: dogfood_secret`, `database: dogfood`)

---

## 🛠️ Docker Composition Commands Reference

Here are the essential Docker Compose commands for running, inspecting, and managing the platform:

| Action | Command | Description |
|---|---|---|
| **Build & Start (Background)** | `docker compose up --build -d` | Builds containers, starts PostgreSQL + Web App in detached mode |
| **Start (Foreground)** | `docker compose up` | Starts containers with combined stdout/stderr output |
| **View Service Status** | `docker compose ps` | Displays status and health checks of all containers |
| **View App Logs** | `docker compose logs -f app` | Streams live server logs (including OTP codes in dev mode) |
| **View Database Logs** | `docker compose logs -f db` | Streams PostgreSQL database engine logs |
| **View All Logs** | `docker compose logs -f` | Streams combined live logs for both services |
| **Restart Web App** | `docker compose restart app` | Restarts the Next.js application container |
| **Stop All Services** | `docker compose down` | Gracefully shuts down and removes containers and networks |
| **Factory Reset (Wipe DB)** | `docker compose down -v` | Shuts down containers and deletes the persistent PostgreSQL volume |
| **Re-run Seed Script** | `docker compose exec app node scripts/seed.js` | Re-seeds sample events, tracks, rubric, and accounts |
| **PostgreSQL CLI** | `docker compose exec db psql -U dogfood -d dogfood` | Opens interactive `psql` console inside the database container |

---

## 🏗️ Docker Compose Architecture

The platform architecture defines two coordinated services in `docker-compose.yml`:

```
┌────────────────────────────────────────────────────────┐
│                   DOCKER COMPOSE                       │
│                                                        │
│  ┌──────────────────────┐      ┌────────────────────┐  │
│  │     Service: db      │      │    Service: app    │  │
│  │                      │◄─────┤                    │  │
│  │  Postgres 16 Alpine  │      │  Next.js Standalone│  │
│  │  Port 5432:5432      │      │  Port 3000:3000    │  │
│  │  Volume: pgdata      │      │  Node.js 20 Alpine │  │
│  │  Healthcheck: 5s     │      │  Prisma + Seeds    │  │
│  └──────────────────────┘      └────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

1. **`db` (Database Service)**:
   - Image: `postgres:16-alpine`
   - Persistent volume: `pgdata` mounted to `/var/lib/postgresql/data`
   - Healthcheck: `pg_isready -U dogfood -d dogfood` ensures database is ready before the application starts.

2. **`app` (Application Service)**:
   - Multi-stage Dockerfile optimized with Alpine Linux and Next.js standalone file-tracing.
   - Depends on `db` with `condition: service_healthy`.
   - On container startup, it automatically executes:
     1. `npx prisma db push --skip-generate` — Synchronizes database tables.
     2. `node scripts/seed.js` — Idempotently provisions initial accounts and sample hackathons.
     3. `node server.js` — Starts the high-performance Next.js production server.

---

## 👥 Pre-Seeded Default Accounts

When the container launches, default accounts are provisioned automatically:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Global Admin** | `admin@dogfood.dev` | `password123` | Full platform administration, superadmin role assignment |
| **Organizer** | `organizer@dogfood.dev` | `password123` | Event creation, rubric definition, judge appointments, live dashboard |
| **Judges** | `judge1@dogfood.dev` to `judge5@dogfood.dev` | `password123` | Score isolation, rubric evaluation, feedback submission |
| **Teams / Participants** | `team1@dogfood.dev` to `team6@dogfood.dev` | `password123` | Team invitations, project submissions, community voting |

---

## 🔑 Environment Configuration

Configure custom third-party integrations by creating a `.env` file (see `.env.example`):

```bash
# Server & Security
DATABASE_URL="postgresql://dogfood:dogfood_secret@db:5432/dogfood"
JWT_SECRET="your-secure-jwt-secret-min-32-chars"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Third-Party Email Delivery (Optional - falls back to Docker logs)
RESEND_API_KEY=""
SENDGRID_API_KEY=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="DOGFOOD Platform <noreply@dogfood.internal>"

# Social OAuth Sign-In (Optional - interactive mock available offline)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
```

---

## 🛡️ Core Platform Features

- **T1 — Core**:
  - Event creation with custom tracks, prize pools, and registration deadlines.
  - Team formation via unique invite links and code-based joining.
  - Project submission with DAL-level deadline enforcement.
  - Public project gallery with real-time search, track filtering, and demo links.

- **T2 — Judging & Normalization**:
  - Organizer live judging dashboard with real-time progress tracking.
  - Weighted rubric builder with custom criteria.
  - **Score Isolation**: Judge scores are strictly DAL-isolated (`WHERE judge_id = session_user_id`).
  - Round-robin scoring assignments.
  - Statistical normalization using **Z-Scores** and **Trimmed Means** to eliminate judge bias.
  - CSV and JSON score exports.

- **T3 — Community & Anti-Sybil Security**:
  - **Account-Bound Anti-Sybil Voting**: Database-enforced unique constraints (`@@unique([userId, projectId])`), pre-deadline account registration cutoff, and self-vote prevention.
  - **Mandatory Email OTP Registration**: 6-digit cryptographic verification code sent via third-party email providers (Resend, SendGrid, SMTP) or printed to Docker logs before account activation.
  - **Forgot Password OTP Reset**: Time-limited (10-minute), max-attempt (5 tries) OTP-verified password reset.
  - **Social OAuth 2.0**: Native sign-in and account linking for **Google**, **GitHub**, and **Discord**.
  - **Audit Logging**: Immutable, append-only audit trail logging user actions, IP addresses, and state changes.

---

## 🧪 Verifying the Installation

To verify that all system invariants pass against your running Docker stack:

```bash
# Test Registration Email OTP & Forgot Password OTP
node scripts/test-registration-and-reset-otp.js

# Test Google / GitHub / Discord OAuth and Account Linking
node scripts/test-oauth-and-providers.js

# Test Anti-Sybil Community Voting & Self-Vote Prevention
node scripts/test-voting.js

# Test Role Management (Superadmin, Organizer, Judge promotion)
node scripts/test-role-management.js
```

---

## 📄 License

MIT
