# GitHub Release Notification System - System Architecture

This document provides a multi-dimensional overview of the architecture of the **GitHub Release Notification System**, covering System, Application, Observability, and Data architecture views.

---

## 1. System (Macro) Architecture

Describes the high-level microservices topology, ingress routing, and inter-service communication protocols.

```mermaid
graph TD
    User([User Browser]) -->|HTTP :3000| Nginx[Nginx Reverse Proxy / Gateway]
    
    subgraph Services ["Microservices Domain"]
        SubService["Subscription Service<br/>(Core User API)"]
        RepoService["Repo Manager Service<br/>(GitHub Release Monitor)"]
        EmailService["Email Service<br/>(Template Engine & SMTP)"]
    end

    subgraph MessageBroker ["Event Bus"]
        RabbitMQ["RabbitMQ (AMQP)"]
    end

    %% Ingress Routing
    Nginx -->|/ or /api| SubService

    %% Inter-service Communication
    SubService <-->|gRPC :50051| RepoService
    SubService -->|HTTP REST :3003| EmailService
    RepoService -->|HTTP REST :3003| EmailService

    %% Event Messaging
    SubService -.->|Publish untrack| RabbitMQ
    RabbitMQ -.->|Subscribe untrack| RepoService
    RepoService -.->|Publish release| RabbitMQ
    RabbitMQ -.->|Subscribe release| SubService

    %% SMTP
    EmailService -->|SMTP| Mailpit[SMTP Mailpit / External Mailer]

    style Nginx fill:#009639,stroke:#006400,stroke-width:2px,color:#fff
    style RabbitMQ fill:#ff6600,stroke:#cc5200,stroke-width:2px,color:#fff
    style SubService fill:#2f80ed,stroke:#1d4ed8,stroke-width:2px,color:#fff
    style RepoService fill:#2f80ed,stroke:#1d4ed8,stroke-width:2px,color:#fff
    style EmailService fill:#2f80ed,stroke:#1d4ed8,stroke-width:2px,color:#fff
```

**Key Points:**
* **Nginx Gateway:** Acts as the single entry point, routing public API and frontend traffic to the subscription service.
* **Hybrid Communication:** Combines synchronous **gRPC** (high-throughput repository queries) and synchronous **HTTP REST** (stateless email dispatching).
* **Asynchronous Event-Driven Messaging:** Uses **RabbitMQ (AMQP)** to decouple actions like untracking repositories or broadcasting new release alerts.

---

## 2. Code (Micro) Architecture

Describes the internal software design pattern inside each microservice.

```mermaid
graph TD
    subgraph Layers ["Onion Layer Structure (Dependency Direction: Inward)"]
        Presentation["Presentation Layer<br/>(routes/, middleware/, grpcServer.ts, app.ts)"]
        Application["Application Layer<br/>(services/*Service.ts, sagaOrchestrator.ts)"]
        Infrastructure["Infrastructure Layer<br/>(db/, config/, client adapters)"]
        Domain["Domain Layer<br/>(types/, models, store interfaces)"]
    end

    %% Dependencies
    Presentation --> Application
    Presentation --> Domain
    Presentation --> Infrastructure
    
    Application --> Domain
    Application -.->|Inverted via Interfaces| Infrastructure
    
    Infrastructure --> Domain

    style Domain fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff
    style Application fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    style Infrastructure fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style Presentation fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff
```

**Key Points:**
* **Strict Layering:** Code is separated into layers where dependencies point only inwards toward the core business domain.
* **Pure Domain Layer:** The core entities, models, and interfaces (`src/types/`) are pure TS and have no references to frameworks, routers, or database clients.
* **Automated Linting & Test Checks:** Validated in each service via custom architecture unit tests ([architecture.test.ts](file:///E:/Education/Genesis/software-engineering-school-6-0-NosarevAndrey-p/services/subscription-service/__tests__/unit/architecture.test.ts)) to prevent regression.

---

## 3. Data & Isolation Architecture

Describes the separation of concerns and storage partitioning.

```mermaid
graph TD
    subgraph Services ["Microservices Layer"]
        SubService["Subscription Service"]
        RepoService["Repo Manager Service"]
    end

    subgraph Postgres ["Shared Physical Postgres Container"]
        subgraph SubDB ["subscription_db (Logical DB 1)"]
            SubTable["subscriptions table"]
            SubMig["migrations (postgres-migrations)"]
        end
        subgraph RepoDB ["notification_db (Logical DB 2)"]
            RepoTable["repositories table"]
            RepoMig["migrations (postgres-migrations)"]
        end
    end

    SubService <-->|SQL Client Connection| SubDB
    RepoService <-->|SQL Client Connection| RepoDB

    style Postgres fill:#336791,stroke:#20405c,stroke-width:2px,color:#fff
    style SubDB fill:#444,stroke:#666,color:#fff
    style RepoDB fill:#444,stroke:#666,color:#fff
```

**Key Points:**
* **Database-per-Service:** Complete schema isolation. Subscription and repository tables exist in separate databases (`subscription_db` and `notification_db`).
* **No DB-Level Joins:** Cross-service data queries are fetched exclusively through API boundaries (such as gRPC) rather than relational foreign keys.
* **Isolated Migrations:** Each service executes its own migrations independently on startup via `postgres-migrations`.

---

## 4. Infrastructure & Observability Architecture

Describes the telemetry stack, log parsing, and metric aggregation channels.

```mermaid
graph TD 
    subgraph Containers ["Docker Compose Environment"]
        SubSrv[Subscription Service]
        RepoSrv[Repo Manager Service]
        EmailSrv[Email Service]

        Vol1[(Log Volume)]

        FluentBit[Fluent Bit Agent]
        Elasticsearch[(Elasticsearch)]
        Kibana[Kibana UI]

        Prometheus[Prometheus Server]
        Grafana[Grafana Dashboards]
    end

    %% Logging Flow
    SubSrv -->|Write JSON logs| Vol1
    RepoSrv -->|Write JSON logs| Vol1
    EmailSrv -->|Write JSON logs| Vol1

    Vol1 -->|Scrape logs| FluentBit
    FluentBit -->|Ship index| Elasticsearch --> Kibana

    %% Metrics Flow
    Prometheus -->|Scrape HTTP /metrics| SubSrv
    Prometheus -->|Scrape HTTP /metrics| RepoSrv
    Prometheus -->|Scrape HTTP /metrics| EmailSrv
    Prometheus --> Grafana

    style FluentBit fill:#4285f4,stroke:#1a0dab,stroke-width:2px,color:#fff
    style Prometheus fill:#e6522c,stroke:#a73516,stroke-width:2px,color:#fff
    style Grafana fill:#f8981d,stroke:#a66108,stroke-width:2px,color:#fff
```





**Key Points:**
* **Centralized Logging:** Docker containers output JSON logs into shared volumes scraped by **Fluent Bit**, which forwards them to **Elasticsearch** for querying inside **Kibana**.
* **Centralized Metrics:** Services expose metrics in standard OpenTelemetry formats via `/metrics` paths, which are collected periodically by **Prometheus** and visualised in **Grafana**.
