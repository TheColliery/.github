# Architecture

## Overview

The system follows a microservices architecture with event-driven communication.

## Services

### Auth Service

Handles user authentication and session management.

TODO: Document the OAuth2 flow once the migration is complete.

### Payment Service

Processes payments through Stripe.

FIXME: This section needs updating after the Stripe v3 migration.

### Notification Service

Sends emails and push notifications.

> **Coming soon:** SMS support via Twilio integration (Q2 2025).

## Data Flow

<!-- TODO: Add architecture diagram -->

Messages flow through the event bus (RabbitMQ) between services.

## Deployment

TBD — deployment documentation will be added after the CI/CD pipeline is finalized.

## Future Work

- Add WebSocket support (planned for v4.0)
- Migrate from REST to gRPC (evaluation in progress)
- Add rate limiting (completed in v3.1)
