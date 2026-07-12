# GitHub Release Notification System

A microservices-based system that allows users to subscribe to email notifications whenever a new release is published on a chosen GitHub repository. 

The system is split into three specialized microservices organized as a monorepo using npm workspaces.

---

## Features

- **Web Dashboard:** A clean, responsive dark-themed user interface to manage subscriptions, view statuses, and add new repos directly from your browser.
- **Microservices Architecture:** Decoupled into:
  - `subscription-service` (User UI & Core API)
  - `notification-service` (Background polling/release monitoring)
  - `email-service` (Stateless email rendering and SMTP dispatching)
- **Database-per-Service Isolation:** Separate databases (`subscription_db` and `notification_db`) run within a single Postgres container, ensuring schema isolation and logical autonomy.
- **Inter-service REST Sync:** The microservices communicate using direct internal REST HTTP endpoints.
- **Self-Healing Scanner:** The background scanner deletes tracked repositories automatically if the `subscription-service` indicates that they have `0` active subscribers, halting redundant API polling.
- **Robust Schema Migrations**: Runs separate programmatic database schema migrations on service start via `postgres-migrations`.
- **Fully Containerized**: Packaged with Docker, Docker Compose, Nginx, Prometheus, Fluent Bit, Elasticsearch, Kibana, and Grafana.

---

## Project Structure

This project uses npm workspaces to organize components:
```
├── services/
│   ├── subscription-service/   # Service A (UI, REST API, subscription_db)
│   ├── notification-service/   # Service B (Scanner, notification_db)
│   └── email-service/          # Service C (Stateless EJS template renderer & SMTP)
├── __tests__/
│   └── e2e/                     # Global Playwright System E2E tests
├── infrastructure/              # Nginx, Fluent Bit, Prometheus, Grafana, and DB configs
├── docker-compose.yml           # Monorepo container orchestrator
└── package.json                 # Monorepo root configuration
```

---

## Running with Docker (Recommended)

### Prerequisites
- Docker and Docker Compose installed.

### Steps
1. Clone the repository and configure `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP credentials, BASE_URL, and GITHUB_TOKEN
   ```

2. Start all services in the background:
   ```bash
   docker compose up --build -d
   ```
   This command starts:
   - `db` — PostgreSQL running both `subscription_db` and `notification_db`.
   - `subscription-service` — public web server on port `3000` (via Nginx proxy).
   - `notification-service` — release scanner on port `3002`.
   - `email-service` — email rendering and dispatching utility on port `3003`.
   - `nginx` — reverse proxy routing port `3000` traffic.
   - `elasticsearch` & `kibana` — central log collection and searching (port `5601`).
   - `fluent-bit` — log scraper routing log files to Elasticsearch.
   - `prometheus` & `grafana` — metrics scraping and visualization (port `3001`).

3. Stop and clean up containers (and database volumes):
   ```bash
   docker compose down -v
   ```

---

## Running Locally (Without Docker)

### Prerequisites
- Node.js 22+
- PostgreSQL database instance running locally.

### Steps
1. Install dependencies for all workspaces at the root:
   ```bash
   npm install
   ```

2. Compile TypeScript for all services:
   ```bash
   npm run build
   ```

3. Start services locally using monorepo workspace scripts:
   - **Start Subscription Service**: `npm run dev:subscription` (starts watch mode on port 3000)
   - **Start Notification Service**: `npm run dev:notification` (starts watch mode on port 3002)
   - **Start Email Service**: `npm run dev:email` (starts watch mode on port 3003)

---

## Running Tests

For detailed, step-by-step instructions on running unit tests, integration tests, and Playwright E2E tests, please refer to the [testing.md](testing.md) guide.

* **Unit Tests (All Workspaces)**:
  ```bash
  npm run test
  ```
* **Integration Tests (All Workspaces)**:
  ```bash
  npm run test:integration
  ```
* **E2E Tests (Playwright)**:
  ```bash
  npm run test:e2e
  ```

---

## REST vs gRPC Throughput Benchmark

We conducted a local end-to-end load test using `autocannon` to compare internal HTTP/REST queries and gRPC calls for the `GET /api/subscriptions` flow (which triggers internal tag fetches to `repo-manager-service`).

### Benchmark Parameters
* **Concurrency**: 20 connections
* **Duration**: 5 seconds

### Performance Comparison

| Metric | REST Mode | gRPC Mode | Difference |
| :--- | :--- | :--- | :--- |
| **Average Latency** | 22.67 ms | 20.02 ms | **-11.68%** (Lower is better) |
| **Requests / Second** | 862.4 req/s | 974 req/s | **+12.94%** (Higher is better) |

### Why gRPC is Faster:
1. **HTTP/2 Transport**: gRPC runs over HTTP/2, enabling request multiplexing over a single TCP connection. This eliminates the head-of-line blocking and TCP handshake overhead of traditional HTTP/1.1 REST calls.
2. **Binary Protocol Buffers**: Data is serialized into a compact binary format rather than verbose JSON strings, resulting in lower CPU parsing overhead and smaller network payloads.