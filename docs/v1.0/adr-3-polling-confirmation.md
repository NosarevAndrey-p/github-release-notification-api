# ADR 3: Polling scanner and confirmation workflow

## Status
Accepted

## Context
The system must notify users about new GitHub releases and avoid sending notifications to unverified email addresses.

## Alternatives considered
- GitHub webhooks for release notifications
- Polling GitHub on a configurable interval
- Immediate notification only at the time of subscription
- No confirmation step for email subscriptions

## Decision
Use a polling scanner to check confirmed repositories periodically. Use token-based email confirmation for subscription activation and separate unsubscribe tokens for opt-out.

## Consequences
- Polling avoids webhook setup complexity, but introduces notification latency.
- The service must track the last seen release tag to avoid duplicate notifications.
- Confirmation tokens ensure that only valid email addresses receive notifications.
- Separate unsubscribe tokens allow users to cancel without needing an account login.
