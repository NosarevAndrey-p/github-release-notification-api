# ADR 1: Database choice

## Status
Accepted

## Context
The service must persist subscriptions and repository metadata. It should support a production-ready database for reliability and a lightweight local development option with minimal setup.

## Alternatives considered
- PostgreSQL only
- SQLite only
- PostgreSQL for production and SQLite for local development
- In-memory storage for prototype only

## Decision
Use PostgreSQL as the primary production database and SQLite as the local development fallback. The application uses an environment variable (`DB_CLIENT`) to choose between implementations.

## Consequences
- PostgreSQL provides durability, concurrency, and better production behavior.
- SQLite allows the project to run locally without requiring an external database service.
- The shared SQL query set simplifies the data access layer.
- The implementation must support DB-specific schema initialization and placeholder translation.
- Might complicate the implementations and database migrations.
