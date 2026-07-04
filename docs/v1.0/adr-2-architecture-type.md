# ADR 2: Architecture style

## Status
Accepted

## Context
The application is an MVP with a small feature set: subscription management, background scanning, and notification delivery. The team needs a simple, easy-to-deploy architecture.

## Alternatives considered
- A single monolithic Node.js service
- Microservices split by API, scanner, and email delivery
- Serverless functions for each capability

## Decision
Keep the architecture as a single monolithic Node.js/Express service for the MVP.

## Consequences
- Deployment and local execution remain simple.
- End-to-end flows are easier to understand and test.
- The scanner and API share data through the same relational store.
- If usage grows, future refactoring may split the scanner or email delivery into separate worker processes.
