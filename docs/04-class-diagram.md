# Class Diagram — Bomb Pass

## Class Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│       Host          │       │    QuestionSet      │
├─────────────────────┤       ├─────────────────────┤
│ - id: int           │       │ - id: int           │
│ - username: string  │       │ - title: string     │
│ - passwordHash: string│     │ - description: string│
│ - createdAt: date   │       │ - subject: string   │
├─────────────────────┤       │ - gradeLevel: string│
│ + login()           │       │ - createdAt: date   │
│ + createQuestionSet()│       ├─────────────────────┤
│ + startSession()    │       │ + getQuestions()    │
│ + endSession()      │       │ + exportRule3Json() │
└─────────┬───────────┘       └──────────┬──────────┘
          │ 1                            │ 1
          │                              │
          │                              │ *
          │                    ┌─────────┴──────────┐
          │                    │      Question       │
          │                    ├────────────────────┤
          │                    │ - id: int          │
          │                    │ - position: int    │
          │                    │ - text: string     │
          │                    │ - type: multiple_choice│
          │                    │   / true_false     │
          │                    │ - correctIndex: int│
          │                    │ - timeLimitSec: int│
          │                    │ - points: int      │
          │                    └─────────┬──────────┘
          │                              │ 1
          │                              │
          │                              │ 2..4
          │                    ┌─────────┴──────────┐
          │                    │      Choice         │
          │                    ├────────────────────┤
          │                    │ - id: int          │
          │                    │ - choiceIndex: int │
          │                    │ - choiceText: string│
          │                    └────────────────────┘
          │
          │ 1
          │
          │ *
┌─────────┴──────────┐       ┌─────────────────────┐
│      Session        │       │      Player         │
├─────────────────────┤       ├─────────────────────┤
│ - id: int           │       │ - id: int           │
│ - joinCode: string  │       │ - sessionId: int    │
│ - status: waiting / │       │ - nickname: string  │
│   playing / ended   │       │ - score: int        │
│ - questionSetId: int│       │ - penaltyCount: int │
│ - bombHolderId: int │       │ - status: active /  │
│ - bombExpiresAt: date│      │   eliminated        │
│ - currentQuestionId │       │ - eliminatedAt: date│
│ - questionExpiresAt │       │ - joinedAt: date    │
│ - winnerPlayerId    │       ├─────────────────────┤
│ - startedAt: date   │       │ + join()           │
│ - endedAt: date     │       │ + submitAnswer()    │
│ - createdAt: date   │       │ + passBomb()        │
├─────────────────────┤       │ + receivePenalty()  │
│ + start()           │       └─────────┬──────────┘
│ + end()             │                 │ 1
│ + reconcile()       │                 │
│ + getLeaderboard()  │                 │ *
└─────────┬───────────┘       ┌─────────┴──────────┐
          │ 1                           │ 1
          │                             │
          │ *                           │ *
┌─────────┴──────────┐       ┌─────────┴──────────┐
│       Bomb          │       │      Answer         │
├─────────────────────┤       ├─────────────────────┤
│ - sessionId: int    │       │ - id: int           │
│ - holderId: int     │       │ - sessionId: int    │
│ - timerDuration: int│       │ - playerId: int     │
│ - expiresAt: date   │       │ - questionId: int   │
├─────────────────────┤       │ - choiceIndex: int  │
│ + passTo()          │       │ - isCorrect: boolean│
│ + expire()          │       │ - submittedAt: date │
│ + resetTimer()      │       ├─────────────────────┤
└─────────────────────┘       │ + validate()        │
                            └─────────────────────┘

┌─────────────────────┐
│     Penalty          │
├─────────────────────┤
│ - id: int           │
│ - playerId: int     │
│ - sessionId: int    │
│ - reason: string    │
│ - createdAt: date   │
├─────────────────────┤
│ + apply()           │
└─────────────────────┘

┌─────────────────────┐
│    Leaderboard       │
├─────────────────────┤
│ - id: int           │
│ - sessionId: int    │
│ - rankings: JSON    │
│ - updatedAt: date   │
├─────────────────────┤
│ + calculate()       │
│ + getRankings()     │
└─────────────────────┘
```

## Class Relationships

| Relationship | Multiplicity | Description |
|--------------|--------------|-------------|
| Host → QuestionSet | 1-to-* | A host creates many question sets |
| Host → Session | 1-to-* | A host starts and ends many sessions |
| QuestionSet → Question | 1-to-* | A question set contains many questions |
| Question → Choice | 1-to-2..4 | A question has 2-4 choices (exactly 2 for true/false) |
| Session → Player | 1-to-* | A session has many players |
| Session → Bomb | 1-to-1 | A session has one bomb at a time |
| Session → Answer | 1-to-* | A session records many answers |
| Session → Penalty | 1-to-* | A session records many penalties |
| Session → Leaderboard | 1-to-1 | A session has one leaderboard |
| Player → Answer | 1-to-* | A player submits many answers |
| Player → Penalty | 1-to-* | A player receives many penalties |

## Application-Layer Classes (Hub Contract v1 implementation)

| Layer | Classes | Responsibility |
|-------|---------|----------------|
| Routes | authRoutes, questionSetRoutes, sessionRoutes | URL mapping only; mounted at `/api/v1` and `/games/bomb-pass/api/v1` |
| Controllers | AuthController, QuestionSetController, SessionController, PlayerController, AnswerController, BombController, LeaderboardController, HealthController | Read input, call a service, send JSON (no SQL, no rules) |
| Services | AuthService, AuthTokenService, QuestionSetService, QuestionFactory, SessionService, SessionStateService, QuestionFlowService, PlayerService, AnswerService, BombService, LeaderboardService | All business rules; lazy expiration (reconcile) and question advancement isolated |
| Repositories | AuthRepository, QuestionSetRepository, SessionRepository, PlayerRepository, AnswerRepository, PenaltyRepository, LeaderboardRepository | ALL SQL, nothing else |
| Middleware | requireHost, requirePlayer, validateBody, errorHandler | Auth (JWT role check), zod validation, single Rule 4 error format |
| Infrastructure | db/pool.js (Singleton), config, AppError, errorCodes | One module-level pg Pool reused across invocations; search_path = bomb_pass |
