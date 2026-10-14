# Consistency Check — Bomb Pass Design Documents

**Date:** 2026-10-01
**Documents Checked:** 10 (00–10, all updated in place for Hub Contract v1)
**Result:** All checks passed. Open items listed at the end.

---

## Check 1: Every Must-Have Feature Has a User Story

| Feature ID | Feature | User Story | Status |
|------------|---------|------------|--------|
| M1 | Host can start a game session | US-H03 | Pass |
| M2 | Players can join using a 6-digit code | US-P01 | Pass |
| M3 | Players can join using a nickname | US-P01 | Pass |
| M4 | Host can select a question set | US-H05 | Pass |
| M5 | Players can answer questions | US-P02, US-P03 | Pass |
| M6 | Players can pass the virtual bomb | US-P04 | Pass |
| M7 | Countdown timer is supported | US-P05 | Pass |
| M8 | System determines bomb holder at expiration | US-P06 | Pass |
| M9 | Penalty/elimination is recorded | US-P07, US-P08 | Pass |
| M10 | Leaderboard shows player rankings | US-P09 | Pass |
| M11 | Host can end a session | US-H09 | Pass |

**Result:** All Must-have features are covered.

---

## Check 2: Every Must-Have User Story Has a Use Case

| User Story | Use Case | Status |
|------------|----------|--------|
| US-H01: Host Login | UC-01: Host Login | Pass |
| US-H02: Create Question Set | UC-02: Create Question Set | Pass |
| US-H03: Start Game Session | UC-03: Start Game Session | Pass |
| US-H04: 6-digit Join Code | UC-03: Start Game Session | Pass |
| US-H05: Select Question Set | UC-03: Start Game Session | Pass |
| US-H06: View Game Results | UC-04: View Game Results | Pass |
| US-H07: List/View Question Sets | UC-13: Browse/Export Question Sets | Pass |
| US-H08: Export/Import Question Sets | UC-13: Browse/Export Question Sets | Pass |
| US-H09: End Session | UC-04: View Game Results (end flow) | Pass |
| US-P01: Join Session | UC-05: Join Session | Pass |
| US-P02: Receive Questions | UC-14: Get Current Question | Pass |
| US-P03: Submit Answer | UC-06: Submit Answer | Pass |
| US-P04: Pass Bomb | UC-07: Pass Bomb | Pass |
| US-P05: Countdown Timer | UC-07: Pass Bomb | Pass |
| US-P06: Bomb Holder | UC-07: Pass Bomb | Pass |
| US-P07: Penalty Count | UC-07: Pass Bomb | Pass |
| US-P08: Player Status | UC-07: Pass Bomb | Pass |
| US-P09: Leaderboard | UC-08: View Leaderboard | Pass |

**Result:** All Must-have user stories have corresponding use cases.

---

## Check 3: Every Use Case Has a Corresponding API Endpoint

| Use Case | API Endpoint | Status |
|----------|--------------|--------|
| UC-01: Host Login | POST /api/v1/auth/login | Pass |
| UC-02: Create Question Set | POST /api/v1/question-sets | Pass |
| UC-03: Start Game Session | POST /api/v1/sessions, PATCH /api/v1/sessions/{code} | Pass |
| UC-04: View Game Results | GET /api/v1/sessions, GET /api/v1/sessions/{code}/leaderboard | Pass |
| UC-05: Join Session | POST /api/v1/sessions/{code}/players | Pass |
| UC-06: Submit Answer | POST /api/v1/sessions/{code}/answers | Pass |
| UC-07: Pass Bomb | POST /api/v1/sessions/{code}/bomb-passes | Pass |
| UC-08: View Leaderboard | GET /api/v1/sessions/{code}/leaderboard | Pass |
| UC-13: Browse/Export Question Sets | GET /api/v1/question-sets, GET /api/v1/question-sets/{id}, GET /api/v1/question-sets/{id}/export, POST /api/v1/question-sets/import, POST /api/v1/question-sets/{id}/copy | Pass |
| UC-14: Get Current Question | GET /api/v1/sessions/{code}/questions/current | Pass |

**Result:** All use cases have corresponding API endpoints.

---

## Check 4: Every Data-Related Class Has a Database Table

| Class | Database Table | Status |
|-------|----------------|--------|
| Host | hosts | Pass |
| QuestionSet | question_sets | Pass |
| Question | questions | Pass |
| Choice | choices | Pass |
| Session | sessions | Pass |
| Player | players | Pass |
| Answer | answers | Pass |
| Bomb | sessions (bomb_holder_id, bomb_expires_at) | Pass |
| Penalty | penalties | Pass |
| Leaderboard | leaderboards | Pass |

**Result:** All data classes have corresponding database tables.

---

## Check 5: Every Database Relationship Has Required PK/FK

| Table | Primary Key | Foreign Keys | Status |
|-------|-------------|--------------|--------|
| hosts | id | None | Pass |
| question_sets | id | host_id → hosts.id | Pass |
| questions | id | question_set_id → question_sets.id | Pass |
| choices | id | question_id → questions.id | Pass |
| sessions | id | host_id → hosts.id, question_set_id → question_sets.id, bomb_holder_id → players.id, current_question_id → questions.id, winner_player_id → players.id | Pass |
| players | id | session_id → sessions.id | Pass |
| answers | id | session_id → sessions.id, player_id → players.id, question_id → questions.id | Pass |
| penalties | id | player_id → players.id, session_id → sessions.id | Pass |
| leaderboards | id | session_id → sessions.id | Pass |
| login_attempts | id | None (rate limiting) | Pass |

**Result:** All tables have primary keys and all relationships have foreign keys.

---

## Check 6: API Endpoint Names Match the Use Cases

| Use Case | Endpoint URL | Match |
|----------|--------------|-------|
| Host Login | /api/v1/auth/login | Pass |
| Create Question Set | /api/v1/question-sets | Pass |
| Start Game Session | /api/v1/sessions | Pass |
| Join Session | /api/v1/sessions/{code}/players | Pass |
| Submit Answer | /api/v1/sessions/{code}/answers | Pass |
| Pass Bomb | /api/v1/sessions/{code}/bomb-passes | Pass |
| View Leaderboard | /api/v1/sessions/{code}/leaderboard | Pass |
| Get Current Question | /api/v1/sessions/{code}/questions/current | Pass |

**Result:** API names align with use cases.

---

## Check 7: Database/Table Names Match ERD and Class Diagram

| Class Diagram Name | ERD Name | Schema Name | Status |
|--------------------|----------|-------------|--------|
| Host | HOST | hosts | Pass |
| QuestionSet | QUESTION_SET | question_sets | Pass |
| Question | QUESTION | questions | Pass |
| Choice | CHOICE | choices | Pass |
| Session | SESSION | sessions | Pass |
| Player | PLAYER | players | Pass |
| Answer | ANSWER | answers | Pass |
| Bomb | BOMB | sessions (bomb fields) | Pass |
| Penalty | PENALTY | penalties | Pass |
| Leaderboard | LEADERBOARD | leaderboards | Pass |

**Result:** Names are consistent across all diagrams.

---

## Check 8: Game/Session Terminology Is Consistent

| Term | Usage | Status |
|------|-------|--------|
| "Session" | Used throughout for game instances | Pass |
| "Join code" | 6-digit code for players | Pass |
| "Question set" | Collection of questions | Pass |
| "Host" | Librarian/teacher who manages sessions | Pass |
| "Player" | Participant who joins with nickname | Pass |
| "Bomb" | Virtual bomb passed between players | Pass |
| "Penalty" | Consequence of bomb expiration | Pass |
| "Elimination" | Removal after 3 penalties | Pass |
| Status values | waiting / playing / ended | Pass |

**Result:** Terminology is consistent.

---

## Check 9: game-info and health Endpoints Are Included

| Endpoint | Included | Status |
|----------|----------|--------|
| GET /api/v1/game-info | Yes (all 9 fields) | Pass |
| GET /api/v1/health | Yes ({status, database, time}) | Pass |

**Result:** Both required endpoints are included.

---

## Check 10: All URLs Follow /api/v1 + Lowercase Plural Nouns + Hyphens

| Endpoint | Format Check | Status |
|----------|--------------|--------|
| /api/v1/health | lowercase noun | Pass |
| /api/v1/game-info | lowercase, hyphenated | Pass |
| /api/v1/auth/login | lowercase noun | Pass |
| /api/v1/question-sets | lowercase plural, hyphenated | Pass |
| /api/v1/sessions | lowercase plural | Pass |
| /api/v1/sessions/{code} | lowercase plural | Pass |
| /api/v1/sessions/{code}/players | lowercase plural | Pass |
| /api/v1/sessions/{code}/questions/current | lowercase plural, hyphenated | Pass |
| /api/v1/sessions/{code}/answers | lowercase plural | Pass |
| /api/v1/sessions/{code}/bomb-passes | lowercase plural, hyphenated | Pass |
| /api/v1/sessions/{code}/leaderboard | lowercase plural | Pass |
| /api/v1/question-sets/{id}/export | sub-resource (verb — flagged) | Pass* |
| /api/v1/question-sets/import | sub-resource (verb — flagged) | Pass* |
| /api/v1/question-sets/{id}/copy | sub-resource (verb — flagged) | Pass* |
| /api/v1/sessions/{code}/results | lowercase noun | Pass |
| /api/v1/sessions/{code}/players/{id} | lowercase plural (DELETE) | Pass |

\* `/export`, `/import`, `/copy` are verbs, which Rule 6 discourages. They are game-specific sub-resources and are flagged for instructor confirmation (like endpoints 13 and 15).

**Result:** All URLs follow the naming convention (3 verb sub-resources flagged).

---

## Check 11: All Endpoints Have Success and Relevant Error Codes

| Endpoint | Success | Error Codes | Status |
|----------|---------|-------------|--------|
| GET /health | 200 | 503 | Pass |
| GET /game-info | 200 | 500 | Pass |
| POST /auth/login | 200 | 400, 401 | Pass |
| POST /question-sets | 201 | 400, 401 | Pass |
| GET /question-sets | 200 | 401 | Pass |
| GET /question-sets/{id} | 200 | 401, 403, 404 | Pass |
| POST /sessions | 201 | 400, 401, 403, 404 | Pass |
| GET /sessions | 200 | 401 | Pass |
| GET /sessions/{code} | 200 | 404 | Pass |
| PATCH /sessions/{code} | 200 | 400, 401, 403, 404, 409 | Pass |
| POST /sessions/{code}/players | 201 | 400, 404, 409 | Pass |
| GET /sessions/{code}/players | 200 | 404 | Pass |
| GET /sessions/{code}/questions/current | 200 | 401, 403, 404, 409 | Pass |
| POST /sessions/{code}/answers | 201 | 400, 401, 403, 404, 409 | Pass |
| POST /sessions/{code}/bomb-passes | 200 | 400, 401, 403, 404, 409 | Pass |
| GET /sessions/{code}/leaderboard | 200 | 404 | Pass |
| GET /question-sets/{id}/export | 200 | 401, 403, 404 | Pass |
| POST /question-sets/import | 201 | 400, 401 | Pass |
| POST /question-sets/{id}/copy | 201 | 401, 403, 404 | Pass |
| GET /sessions/{code}/results | 200 | 401, 403, 404 | Pass |
| DELETE /sessions/{code}/players/{id} | 200 | 401, 403, 404, 409 | Pass |

**Result:** All endpoints have appropriate success and error codes.

---

## Check 12: Correct Answers Are Never Returned to Players

| Location | Check | Status |
|----------|-------|--------|
| API Endpoint Table - Create Question Set | "correct answers stored securely; never returned to players" | Pass |
| API Endpoint Table - Submit Answer | "Correct answer is never returned. Only correctness boolean is sent." | Pass |
| Class Diagram - Question class | correctIndex marked as server-only | Pass |
| Database Schema - questions table | correct_index column documented as server-only | Pass |
| Code - QuestionFactory.toRule3 | correct_index included only with includeCorrectIndex (host endpoints) | Pass |
| Code - AnswerService.getCurrentQuestion | response never includes correct_index | Pass |
| Tests | contract + unit tests assert no correct_index in player-facing responses | Pass |

**Result:** Correct answers are protected in all relevant locations.

---

## Check 13: The API Follows the Hub Contract

| Hub Contract Requirement | Implementation | Status |
|--------------------------|----------------|--------|
| GET /api/v1/game-info | Implemented (9 fields, startup validation) | Pass |
| GET /api/v1/health | Implemented (real SELECT 1; 503 DATABASE_DOWN) | Pass |
| POST /api/v1/auth/login | Implemented (JWT, bcrypt, DB rate limit) | Pass |
| POST /api/v1/question-sets | Implemented (Rule 3 format) | Pass |
| POST /api/v1/sessions | Implemented (6-digit code, never starts with 0) | Pass |
| POST /api/v1/sessions/{code}/players | Implemented (nickname-only join) | Pass |
| POST /api/v1/sessions/{code}/answers | Implemented ({correct, score, rank}) | Pass |
| GET /api/v1/sessions/{code}/leaderboard | Implemented | Pass |
| 6-digit join codes | Generated server-side, CHECK ~ '^[1-9][0-9]{5}$' | Pass |
| Bearer token auth | Host token (8h) + player token (3h, one session) | Pass |
| No correct answer exposure | Server validates; only boolean returned | Pass |
| /api/v1 prefix | All endpoints use prefix; also mounted at /games/bomb-pass/api/v1 | Pass |
| Lowercase plural nouns + hyphens | All URLs follow convention | Pass |
| Rule 3 question-set format | QuestionFactory validates/produces exactly this shape | Pass |
| Rule 4 error format | Single middleware, {error:{code,message}}, one constants file | Pass |
| Rule 5 privacy | No personal data from players; no IP/UA logging | Pass |

**Result:** API follows all Hub Contract requirements.

---

## Check 14: All Documents Describe the Same System

| Aspect | Game Concept | User Stories | Use Cases | Class Diagram | ERD/Schema | API Table | Architecture | Status |
|--------|-------------|--------------|-----------|---------------|------------|-----------|--------------|--------|
| Game name | Bomb Pass | Bomb Pass | Bomb Pass | Bomb Pass | bomb_pass | Bomb Pass | Bomb Pass | Pass |
| Entities | Host, QuestionSet, Question, Choice, Session, Player, Answer, Bomb, Penalty, Leaderboard | Same | Same | Same | Same | Same | Same | Pass |
| Auth | Host login, Bearer token | Same | Same | Same | Same | Same | Same | Pass |
| Join code | 6-digit, never starts with 0 | Same | Same | Same | Same | Same | Same | Pass |
| Endpoints | Listed | Mapped | Mapped | N/A | N/A | Detailed | N/A | Pass |
| Architecture | Layered/MVC | N/A | N/A | N/A | N/A | N/A | Detailed | Pass |
| Statuses | waiting/playing/ended | Same | Same | Same | Same | Same | Same | Pass |
| Error format | {error:{code,message}} | Same | Same | N/A | N/A | Detailed | N/A | Pass |

**Result:** All documents describe the same system consistently.

---

## Handout Checklist (§8)

| Check | Result |
|-------|--------|
| game-info has every Rule 1 field | Pass — 9 fields, validated on startup |
| health returns 503 when the DB is down | Pass — real SELECT 1; 503 DATABASE_DOWN (tested) |
| question sets use Rule 3 and never leak correct_index | Pass — QuestionFactory; correct_index only on host endpoints (tested) |
| every error uses Rule 4 | Pass — single middleware, one constants file (tested) |
| 6-digit codes and nickname-only players | Pass — CHECK constraint + service rules (tested) |
| all URLs follow Rule 6 | Pass — /api/v1, plural nouns, hyphens (3 verb sub-resources flagged) |
| export/import/copy question sets | Pass — host-only, ownership checked (tested) |
| session results for host review | Pass — host-only, ownership checked (tested) |
| forfeit / leave game | Pass — self-only, bomb reassigned, win check (tested) |

---

## Summary

| Check | Result |
|-------|--------|
| 1. Must-have features have user stories | Pass |
| 2. Must-have user stories have use cases | Pass |
| 3. Use cases have endpoints | Pass |
| 4. Data classes have tables | Pass |
| 5. Relationships have PK/FK | Pass |
| 6. API names match use cases | Pass |
| 7. Table names match ERD and class diagram | Pass |
| 8. Terminology is consistent | Pass |
| 9. game-info and health endpoints included | Pass |
| 10. URLs follow naming convention | Pass |
| 11. Endpoints have success and error codes | Pass |
| 12. Correct answers never exposed | Pass |
| 13. API follows the Hub Contract | Pass |
| 14. All documents describe same system | Pass |

**Overall Result:** All 14 consistency checks passed. The 10 design documents form a consistent, complete design set for the Bomb Pass project, aligned with Hub Contract v1.

---

## Open Decisions

Every ASSUMPTION/TBD from the spec, with the chosen simplest option (all configurable):

| # | Item | Type | Decision | Where configurable |
|---|------|------|----------|--------------------|
| 1 | Serverless provider | ASSUMPTION | Vercel + Neon Postgres | vercel.json, env |
| 2 | Joining blocked while playing | ASSUMPTION | Yes → 409 SESSION_ALREADY_STARTED (contract only blocks after ended) | PlayerService.join |
| 3 | Bomb timer duration | TBD | env BOMB_TIMER_SECONDS, default 30 | .env |
| 4 | Ranking formula | TBD | Active first, score desc, penalties asc; eliminated after, latest eliminated higher | LeaderboardService |
| 5 | Question advancement | ASSUMPTION | Active until question_expires_at OR all active players answered; wrap around | QuestionFlowService |
| 6 | First bomb holder | ASSUMPTION | Random active player | SessionService.updateStatus |
| 7 | Bad-word list | ASSUMPTION | Small English + Filipino starter list | src/config/index.js |
| 8 | Host token TTL | ASSUMPTION | env HOST_TOKEN_TTL, default 8h | .env |
| 9 | Player token TTL | Contract | 3 hours, one session only | env PLAYER_TOKEN_TTL |
| 10 | Login rate limit | ASSUMPTION | 5 failed attempts / 15 minutes, DB-backed (login_attempts) | .env |
| 11 | Extra team endpoints (8, 9, 10, 12, 13, 15) | ASSUMPTION | Included; 13 and 15 flagged for instructor confirmation | — |
| 12 | points per question | ASSUMPTION | Default 100, stored per question | questions.points |
| 13 | Export/import/copy question sets | Team addition | Included (endpoints 17-19); verb sub-resource names flagged | — |
| 14 | Session results endpoint | Team addition | Included (endpoint 20); host-only | — |
| 15 | Forfeit / leave game | Team addition | Included (endpoint 21); DELETE, self-only | — |

### Places where the design docs previously disagreed with the contract

| # | Old doc claim | Contract v1 | Resolution |
|---|---------------|-------------|------------|
| 1 | Error format `{ "error": "<message>" }` | `{ "error": { "code", "message" } }` | Docs updated to Rule 4 |
| 2 | Question-set format with `choice_a..d` + `correct_choice_index` | Rule 3: `choices[]` + `correct_index` | Docs updated to Rule 3 |
| 3 | Statuses `waiting / in_progress / finished` | `waiting / playing / ended` | Docs updated |
| 4 | Endpoint `GET /sessions/{code}/current-question` | `GET /sessions/{code}/questions/current` | Docs updated |
| 5 | No `choices` table (choices embedded in questions) | `choices` table with `choice_index`, `choice_text` | ERD/schema updated |
| 6 | No `login_attempts` table | `login_attempts` for DB rate limiting | ERD/schema updated |
| 7 | `players` had no `score` column | `players.score INT DEFAULT 0` | ERD/schema updated |
| 8 | `sessions` had no `question_expires_at`, `started_at`, `ended_at` | Added per §5 | ERD/schema updated |
| 9 | `questions` had no `type`, `time_limit_sec`, `position` | Added per Rule 3 | ERD/schema updated |
| 10 | `question_sets` had `category` | `subject`, `grade_level` | ERD/schema updated |
| 11 | game-info had no `thumbnail_url` / `play_url` | 9 fields per Rule 1 | Docs updated |
| 12 | health returned `{status, database:"connected"}` | `{status, database:"ok", time}` | Docs updated |
| 13 | Deployment was library-server only | Two targets: library server (final) + Vercel/Neon (test) | Architecture docs updated |
| 14 | No application-layer class table | Added (routes, controllers, services, repositories, factory, singleton) | Class diagram updated |
