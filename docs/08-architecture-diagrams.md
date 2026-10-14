# Architecture + Component + Deployment Diagrams — Bomb Pass

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│                   (Web Browser)                              │
└──────────────────────────┬──────────────────────────────────┘
                            │ HTTP/JSON (poll every 1-2s)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        ROUTES                                │
│  /api/v1/health  /api/v1/game-info  /api/v1/auth/login      │
│  /api/v1/question-sets  /api/v1/sessions                    │
│  /api/v1/sessions/{code}/players                            │
│  /api/v1/sessions/{code}/questions/current                  │
│  /api/v1/sessions/{code}/answers                            │
│  /api/v1/sessions/{code}/bomb-passes                        │
│  /api/v1/sessions/{code}/leaderboard                        │
│  (same router also mounted at /games/bomb-pass/api/v1)      │
└──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     CONTROLLERS                              │
│  HealthController   AuthController   QuestionSetController  │
│  SessionController  PlayerController  AnswerController       │
│  BombController     LeaderboardController                    │
└──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES                                │
│  AuthService    AuthTokenService    QuestionSetService       │
│  QuestionFactory    SessionService    SessionStateService    │
│  QuestionFlowService    PlayerService    AnswerService       │
│  BombService    LeaderboardService                           │
└──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     REPOSITORIES                             │
│  AuthRepository    QuestionSetRepository    SessionRepository│
│  PlayerRepository  AnswerRepository  PenaltyRepository       │
│  LeaderboardRepository                                      │
└──────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE                               │
│  PostgreSQL schema bomb_pass:                               │
│  hosts | login_attempts | question_sets | questions         │
│  choices | sessions | players | answers | penalties         │
│  leaderboards                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│                   (Web Browser)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Auth      │  │  Question   │  │  Sessions   │          │
│  │   Routes    │  │  Set Routes │  │  Routes     │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐          │
│  │   Player    │  │   Answer    │  │    Bomb     │          │
│  │   Routes    │  │   Routes    │  │   Routes    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐          │
│  │Leaderboard  │  │   Health    │  │  Game Info  │          │
│  │   Routes    │  │   Routes    │  │   Routes    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   HUB CONTRACT LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Auth      │  │  Question   │  │  Sessions   │          │
│  │   Service   │  │  Set Service│  │  Service    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐          │
│  │   Player    │  │   Answer    │  │    Bomb     │          │
│  │   Service   │  │   Service   │  │   Service   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐          │
│  │  Penalty    │  │ Leaderboard │  │   Health    │          │
│  │  Service    │  │  Service    │  │  Service    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   hosts     │  │question_sets│  │  questions  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  sessions   │  │   players   │  │   answers   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │  penalties  │  │ leaderboards│                          │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Diagram 1: Library Server (FINAL TARGET, Hub Contract §7)

```
┌─────────────────────────────────────────────────────────────┐
│                  LIBRARY NETWORK                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        HUB  →  forwards /games/bomb-pass/*           │   │
│  │              to the Bomb Pass port                   │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │ HTTP/JSON                      │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LIBRARY SERVER                           │   │
│  │              node server.js                          │   │
│  │              Port: env PORT (default 3001)            │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │           BOMB PASS API (Express)            │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │   │
│  │  │  │  Auth   │ │ Sessions│ │ Players │        │   │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘        │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │   │
│  │  │  │Question │ │ Answers │ │  Bomb   │        │   │   │
│  │  │  │  Sets   │ │         │ │         │        │   │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘        │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │   │
│  │  │  │ Penalty │ │Leaderbrd│ │ Health  │        │   │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘        │   │   │
│  │  │  Router mounted at /api/v1 AND                │   │   │
│  │  │  /games/bomb-pass/api/v1                      │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │ SQL (parameterized)           │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              DATABASE SERVER                          │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  PostgreSQL · schema: bomb_pass              │   │   │
│  │  │  (env DB_SCHEMA, set via search_path)        │   │   │
│  │  │  Tables:                                     │   │   │
│  │  │    hosts · login_attempts · question_sets    │   │   │
│  │  │    questions · choices · sessions · players   │   │   │
│  │  │    answers · penalties · leaderboards        │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Diagram 2: Serverless Test Server (Vercel + Neon)

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERNET (test only)                     │
│                                                             │
│  ┌─────────────┐         ┌───────────────────────────────┐ │
│  │   CLIENT    │         │   VERCEL SERVERLESS FUNCTION   │ │
│  │  (Postman)  │────────>│   /api/index.js                │ │
│  └─────────────┘  HTTPS  │   (same Express app, exported)  │ │
│                         │   · stateless, no timers         │ │
│                         │   · module-level pg Pool         │ │
│                         │     reused across warm instances │ │
│                         └───────────────┬─────────────────┘ │
│                                         │ pooled connection  │
│                                         │ string            │
│                                         ▼                   │
│                         ┌───────────────────────────────┐   │
│                         │   NEON SERVERLESS POSTGRES     │   │
│                         │   schema: bomb_pass             │   │
│                         └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Serverless-Safe Reconcile Timing Note

There are NO background timers (`setTimeout`/`setInterval`), no in-memory
game state, and no WebSockets. Expiration is lazy: every request that reads
or changes a session first calls `SessionStateService.reconcile(code)`,
which in one transaction (with `SELECT ... FOR UPDATE` on the session row)
processes all missed bomb expirations and advances the question. Clients
poll `GET /api/v1/sessions/{code}` every 1-2 s, which drives reconciliation.
This keeps the API stateless and safe to run on short-lived serverless
functions as well as on the library server.

## Design Patterns Used

| Pattern | Usage |
|---------|-------|
| **Repository Pattern** | All database operations isolated in repository classes; controllers never write SQL |
| **Singleton Pattern** | Single database connection pool for the entire API |
| **Factory Pattern** | Centralized creation of question objects from JSON input |
| **MVC Pattern** | Model (data/rules), View (JSON response), Controller (traffic officer) |
