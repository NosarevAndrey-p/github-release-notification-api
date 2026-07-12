# Testing Instructions

This project features three types of automated testing: **Unit Tests**, **Integration Tests**, and **E2E Tests**.
All database dependencies (PostgreSQL test containers) are automatically spun up from scratch using Docker when running integration or E2E tests. No manual database setup or cleanup is required.

---

## 📋 Prerequisites

To run these tests locally, you only need to have the following installed on your machine:
1. **Git**
2. **Docker / Docker Compose**
3. **Node.js** (version 18+)

---

## 🚀 Running All Tests in One Command

To execute all three test suites (Unit, Integration, and E2E) sequentially with fully automated container lifecycles, run:

```bash
npm run test:all
```

*(This command runs Unit tests first, spins up the Docker test database, executes Integration tests, cleans up the database, starts the database and server for E2E tests, executes the Playwright browser tests, and finally shuts down all test containers and volumes).*

---

## 🔍 Running Test Suites Separately

If you want to run a specific group of tests:

### 1. Unit Tests (Service logic and validators)
These tests do not require a database or network connections (all external integrations are mocked).
```bash
npm run test
```

### 2. Integration Tests (API endpoints with a real DB)
This suite automatically launches a PostgreSQL container on port `5434`, runs schema migrations, runs the tests, and shuts down the container with volume cleanup.
```bash
npm run test:integration
```

### 3. E2E Tests (User scenarios via Playwright)
This suite automatically launches a PostgreSQL container on port `5434`, runs migrations, starts the Express app server on a conflict-free port `8989`, launches a local mock GitHub API server on port `3002`, executes the E2E tests in a headless Chromium browser, and cleans up all running test servers and containers afterwards.
```bash
npm run test:e2e
```

---

## 🛠️ Maintenance Commands

If you ever need to manually stop or clean up the background Docker test containers:

```bash
# Stop the test database container and delete its volumes
docker compose -f docker-compose.test.yml down -v
```
