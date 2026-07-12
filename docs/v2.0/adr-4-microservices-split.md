# ADR 4: Microservices Split & Database-per-Service Isolation

## Status
Accepted

## Context
In the previous v1.0 monolithic architecture, the single application handled all system responsibilities:
- Serving the frontend dashboard.
- Handling subscription sign-ups and opt-in/opt-out confirmation flows.
- Running background scan loops polling the GitHub API for new tags.
- Dispatching email alerts to all active subscribers.
- Querying a shared database with tight table coupling between `subscriptions` and `repositories`.

This monolithic approach suffered from several drawbacks:
1. **Scaling Mismatch**: The CPU-heavy background scanning and HTTP-limited GitHub API polling competed for resource loops with user-facing dashboard requests.
2. **Coupling**: The DB schema bound subscription records to repository records with foreign keys, preventing database schema flexibility.
3. **Deployability**: Any change to scanner logic required redeploying the web server.

## Decision
We decided to split the monolithic application into two standalone services:
1. **`subscription-service`**:
   - Exposes public APIs for dashboard loading, subscription creation, opt-in, and opt-out.
   - Serves the frontend web dashboard.
   - Manages its own database (`subscription_db`) containing only the `subscriptions` table.
2. **`notification-service`**:
   - Manages background cron loops scanning tracked GitHub repositories.
   - Handles email alert rendering and delivery.
   - Manages its own database (`notification_db`) containing only the `repositories` table.

### Inter-Service Communication
We implemented synchronous HTTP REST communication:
- **Validation**: When a user subscribes, `subscription-service` calls `POST http://notification-service/api/internal/repositories` to validate and track the repository.
- **Scanner Subscriptions**: During a scan cycle, `notification-service` queries `GET http://subscription-service/api/internal/subscriptions?repo=...` to get confirmed emails.
- **Metadata**: During dashboard rendering, `subscription-service` queries `GET http://notification-service/api/internal/repositories?repo=...` to dynamically fetch tag information.

### DB Schema Isolation
We replaced the database-level foreign key constraints. Subscriptions now track repositories using the string `repo_name` directly. Each service manages its own migrations via `postgres-migrations`.

## Consequences
- **Pros**:
  - Independent scalability of background job polling vs web traffic.
  - Logical isolation of databases makes each service completely autonomous.
  - Zero shared-database dependency.
- **Cons**:
  - Requires running and orchestrating two HTTP servers instead of one.
  - Network overhead on inter-service queries.
  - Potential distributed state issues (partially resolved by the self-healing scanner behavior which cleans up local repos if they have 0 active subscribers).
