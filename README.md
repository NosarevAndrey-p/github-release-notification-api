# GitHub Release Notification API

A monolithic REST API that lets users subscribe to email notifications whenever a new release is published on a chosen GitHub repository.

---

## Features

- Subscribe an email address to release notifications for any public GitHub repository
- Email confirmation flow — subscriptions are activated only after confirmation
- Background scanner that periodically polls GitHub for new releases and sends email alerts
- Per-repository `last_seen_tag` tracking — notifications are sent only for genuinely new releases
- GitHub API validation on subscription (returns `404` if repo doesn't exist, `400` for bad format)
- Graceful handling of GitHub API rate limiting (`429 Too Many Requests`)
- Database migrations run automatically on startup
- Uses **PostgreSQL** as the database
- Fully containerized with Docker and Docker Compose

---

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express 5
- **Database:** PostgreSQL (via `pg`)
- **Email:** Nodemailer
- **Testing:** Jest + Supertest
- **Containerization:** Docker + Docker Compose

---

## Project Structure

```
├── routes/          # Express route definitions (subscribe, confirm, unsubscribe, subscriptions)
├── services/        # Business logic (GitHub API, email sending, scanner)
├── models/          # Database access layer
├── db/              # Migration scripts and DB client setup
├── lib/             # Utility helpers (token generation, validators, etc.)
├── __tests__/       # Unit and integration tests
├── app.js           # Express app setup
├── server.js        # Entry point — runs migrations, starts server and scanner
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints

All endpoints are prefixed with `/api`. The full contract is defined in `swagger.yaml`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/subscribe` | Subscribe an email to a GitHub repository's releases |
| `GET` | `/api/confirm/:token` | Confirm subscription via emailed token |
| `GET` | `/api/unsubscribe/:token` | Unsubscribe using token from notification emails |
| `GET` | `/api/subscriptions?email=...` | List all active subscriptions for an email |

### `POST /api/subscribe`

**Body** (form-data or `application/x-www-form-urlencoded`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Subscriber's email address |
| `repo` | string | ✅ | GitHub repo in `owner/repo` format (e.g. `golang/go`) |

**Responses:**

- `200` — Subscribed successfully, confirmation email sent
- `400` — Invalid input (malformed email or repo format)
- `404` — Repository not found on GitHub
- `409` — Email already subscribed to this repository

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# GitHub personal access token (optional but recommended)
# Without token: 60 req/hour rate limit
# With token: 5000 req/hour rate limit
GITHUB_TOKEN=

# SMTP settings for sending emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

# How often the scanner checks for new releases (in milliseconds)
# Default: 60000 (1 minute)
SCAN_INTERVAL=60000

# SCAN_INTERVAL=60000

# PostgreSQL connection settings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=repo_subscriber

# Full connection URL (used by the app; Docker sets this automatically)
DATABASE_URL=postgresql://postgres:postgres@db:5432/repo_subscriber
```

### Gmail SMTP Notes

If using Gmail, you must use an **App Password** (not your regular account password):

1. Enable 2-factor authentication on your Google account
2. Go to **Google Account → Security → App passwords**
3. Create a new app password and paste it into `SMTP_PASS`

---

## Running with Docker (Recommended)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/NosarevAndrey-p/github-release-notification-api.git
   cd github-release-notification-api
   ```

2. Create your `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP credentials and optional GitHub token
   ```

3. Start the services:
   ```bash
   docker-compose up --build
   ```

   This will spin up:
   - **`app`** — the Node.js API server (port `3000`)
   - **`db`** — a PostgreSQL database

4. The API will be available at `http://localhost:3000`

Database migrations run automatically when the app container starts.

### Stopping the services

```bash
docker-compose down
```

To also remove the database volume:

```bash
docker-compose down -v
```

---

## Running Locally (Without Docker)

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your `.env`:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   Or production mode:
   ```bash
   npm start
   ```

---

## Running Tests

```bash
npm test
```

This runs the full Jest test suite with coverage reporting. Tests cover the core business logic in `services/` and route handlers.

---

## How It Works

### Subscription Flow

1. User calls `POST /api/subscribe` with their email and a target repo.
2. The service validates the repo format and checks its existence via the GitHub API.
3. If valid, a subscription record is created (unconfirmed) and a confirmation email is sent with a unique token link.
4. User clicks the confirmation link (`GET /api/confirm/:token`) — subscription becomes active.
5. To unsubscribe, user clicks the unsubscribe link in any notification email (`GET /api/unsubscribe/:token`).

### Release Scanner

- A background scanner runs on the interval defined by `SCAN_INTERVAL`.
- On each tick, it fetches all confirmed subscriptions and checks the GitHub Releases API for each watched repository.
- If a new release tag is found (different from the stored `last_seen_tag`), a notification email is sent and `last_seen_tag` is updated in the database.
- Repositories are deduplicated so the GitHub API is only called once per repo per scan cycle, regardless of how many subscribers watch it.

### Rate Limit Handling

The service respects GitHub's API rate limits:
- Without a `GITHUB_TOKEN`: 60 requests/hour
- With a `GITHUB_TOKEN`: 5000 requests/hour

When a `429 Too Many Requests` response is received, the service logs the event and skips the current scan cycle rather than crashing. It is strongly recommended to set a `GITHUB_TOKEN` in production.

---

## API Documentation

The full Swagger specification is available in `swagger.yaml`. You can view it interactively at [https://editor.swagger.io/](https://editor.swagger.io/) by pasting the file contents.