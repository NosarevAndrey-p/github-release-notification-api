# ADR 1: Database choice

## Status
Superseded (by PR review feedback)

## Context
The service must persist subscriptions and repository metadata. Initially, a dual-database approach (PostgreSQL and SQLite) was used to facilitate local development.

## Alternatives considered
- PostgreSQL only
- SQLite only
- PostgreSQL for production and SQLite for local development (Initial choice)
- In-memory storage for prototype only

## Decision
Use PostgreSQL only. Supporting two database engines added unnecessary complexity and maintenance overhead without significant benefits, as Docker is the preferred way to run the application locally.

## Consequences
- Reduced codebase complexity.
- Unified query syntax (using PostgreSQL-specific placeholders and features like `RETURNING id`).
- PostgreSQL provides durability, concurrency, and better production behavior.
- Local development requires a PostgreSQL instance (easily provided via Docker Compose).
