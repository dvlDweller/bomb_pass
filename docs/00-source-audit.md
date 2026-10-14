# Source/Requirement Audit — Bomb Pass

| # | Requirement | Source | Status | Notes |
|---|-------------|--------|--------|-------|
| 1 | API prefix `/api/v1` | Hub Contract v1 (Rule 6) | CONFIRMED | All endpoints use this prefix; router also mounted at `/games/bomb-pass/api/v1` |
| 2 | `GET /api/v1/game-info` endpoint | Hub Contract v1 (Rule 1) | CONFIRMED | 9 fields incl. thumbnail_url and play_url; validated on startup |
| 3 | `GET /api/v1/health` endpoint | Hub Contract v1 (Rule 2) | CONFIRMED | 200 `{status:"ok",database:"ok",time}` only when a real `SELECT 1` succeeds; 503 DATABASE_DOWN otherwise |
| 4 | Host login via `POST /api/v1/auth/login` | Hub Contract v1 (Rule 5) | CONFIRMED | Returns JWT; bcrypt password hash; DB-based rate limiting via login_attempts |
| 5 | Players join with nickname + 6-digit code, no account | Hub Contract v1 (Rule 5) | CONFIRMED | No player registration; nickname 2-20 chars, bad-word filtered |
| 6 | 6-digit session/join codes | Hub Contract v1 (Rule 5) | CONFIRMED | Server-generated, never starts with 0, unique among open sessions |
| 7 | One question-set format for all teams | Hub Contract v1 (Rule 3) | CONFIRMED | `{title, description, subject, grade_level, questions:[{text, type, choices[], correct_index, time_limit_sec}]}`; validated in QuestionFactory |
| 8 | One error format for all teams | Hub Contract v1 (Rule 4) | CONFIRMED | `{error:{code,message}}` from a single middleware; codes in one constants file |
| 9 | Server determines answer correctness | Hub Contract v1 (Rule 3) | CONFIRMED | correct_index never sent to players; only host endpoints may return it |
| 10 | Bearer authentication for protected endpoints | Hub Contract v1 (Rule 5) | CONFIRMED | JWT behind AuthTokenService; host token TTL env HOST_TOKEN_TTL (default 8h); player token 3h, one session only |
| 11 | REST URL rules: lowercase, plural nouns, hyphens, no verbs | Hub Contract v1 (Rule 6) | CONFIRMED | Fixed names: auth, question-sets, sessions, players, answers, leaderboard; game-specific: bomb-passes, questions |
| 12 | HTTP methods: GET/POST/PUT/PATCH/DELETE | Hub Contract v1 | CONFIRMED | API uses GET/POST/PATCH |
| 13 | Status codes: 200, 201, 400, 401, 403, 404, 409, 500, 503 | Hub Contract v1 (Rule 4) | CONFIRMED | |
| 14 | Layered architecture: Client → Routes → Controllers → Services → Repositories → Database | Hub Contract v1 | CONFIRMED | |
| 15 | Game title: Bomb Pass | Bomb Pass Team Requirement (3.1) | CONFIRMED | |
| 16 | Genre: Multiplayer Question-Based Action Game | Bomb Pass Team Requirement (3.3) | CONFIRMED | |
| 17 | Platform: Web Browser | Bomb Pass Team Requirement (3.4) | CONFIRMED | |
| 18 | 3-30 players | Bomb Pass Team Requirement (3.5) | CONFIRMED | |
| 19 | Core loop: Join → Answer → Pass → Explode → Penalize → Win | Bomb Pass Team Requirement (3.7) | CONFIRMED | 6 verbs per Hub Contract v1 |
| 20 | Penalty rule: 1 penalty per explosion, 3 penalties = elimination | Bomb Pass Team Requirement (3.10) | CONFIRMED | |
| 21 | Passing rules: only holder can pass, no self-pass, target must be active | Bomb Pass Team Requirement (3.11) | CONFIRMED | |
| 22 | Server authoritative for all game state | Bomb Pass Team Requirement (3.12) | CONFIRMED | |
| 23 | Win condition: last active player wins | Bomb Pass Team Requirement (3.13) | CONFIRMED | |
| 24 | Leaderboard shows rankings | Bomb Pass Team Requirement (3.14) | CONFIRMED | Ranking formula TBD, isolated in LeaderboardService |
| 25 | MoSCoW features | Bomb Pass Team Requirement (3.15) | CONFIRMED | |
| 26 | `POST /api/v1/sessions/{code}/bomb-passes` endpoint | Bomb Pass Team Proposal (Section 4) | CONFIRMED | Allowed as a game-specific resource (Rule 6); flagged for instructor confirmation |
| 27 | Question-set JSON format details | Hub Contract v1 (Rule 3) | CONFIRMED | Exact format implemented in QuestionFactory |
| 28 | Error JSON format details | Hub Contract v1 (Rule 4) | CONFIRMED | Exact format implemented in error-handling middleware |
| 29 | Token technology | Hub Contract v1 (Rule 5) | CONFIRMED | JWT (jsonwebtoken) behind AuthTokenService; swappable |
| 30 | Database technology | Hub Contract v1 (§5) | CONFIRMED | PostgreSQL, schema `bomb_pass` (env DB_SCHEMA, search_path) |
| 31 | Deployment: library server (final) + Vercel/Neon (test) | Hub Contract v1 (§2, §7) | CONFIRMED | `node server.js` on env PORT (default 3001); `/api/index.js` serverless export |
| 32 | Bomb timer duration | Hub Contract v1 (§7) | TBD | env BOMB_TIMER_SECONDS, default 30 |
| 33 | Scoring formula | Hub Contract v1 (§7) | TBD | env-configurable points per question (default 100); ranking isolated in LeaderboardService |

---

## CONFLICTS / MISSING INFORMATION

### Critical Missing Documents

| Item | Impact | Action Required |
|------|--------|-----------------|
| **Hub Contract v1 handout** | Was the source of truth for Rules 1-6 | RESOLVED — contract v1 embedded in the project spec; Rules 1-6 implemented exactly |
| **Token technology specification** | Cannot document auth flow details beyond "Bearer" | RESOLVED — JWT chosen, behind AuthTokenService |
| **Database technology** | Schema uses generic SQL; may need adjustment | RESOLVED — PostgreSQL, schema bomb_pass |
| **Bomb timer duration** | Cannot specify game timing | OPEN — env BOMB_TIMER_SECONDS, default 30; confirm with instructor |
| **Scoring formula** | Leaderboard ranking logic unclear | OPEN — ranking rule isolated in LeaderboardService; confirm with instructor |

### Potential Conflicts

| # | Conflict | Resolution |
|---|----------|------------|
| 1 | Handout p.28 shows `POST /sessions/{code}/answers` with "Player" auth, but does not show player token issuance endpoint | RESOLVED — player token issued at join (POST /sessions/{code}/players), 3h, one session only |
| 2 | Handout p.24 shows `Authorization: Bearer <player token>` but no player login/join token flow is documented | RESOLVED — token issued at join |
| 3 | `POST /api/v1/sessions/{code}/bomb-passes` is NOT in the handout sample table | RESOLVED — allowed as game-specific resource per Rule 6; flagged for instructor confirmation |
| 4 | Handout shows `GET /sessions/{code}/players` as a good URL (p.25) but not in sample API table | RESOLVED — included as team endpoint #12 |

### Items That Must NOT Be Invented

- Exact scoring formula (TBD — isolated in LeaderboardService)
- Exact timer duration (TBD — env BOMB_TIMER_SECONDS, default 30)
- Random timer algorithm
- Serverless deployment provider (ASSUMPTION: Vercel + Neon)
- Password hashing method (bcrypt chosen; contract only requires "never plain text")
- Question format details beyond Rule 3
- Error format details beyond Rule 4

### Open Questions for the Instructor

| # | Question | Context |
|---|----------|---------|
| 1 | Which serverless provider for the test deploy? | ASSUMPTION: Vercel + Neon Postgres |
| 2 | Should joining be blocked while the game is playing? | ASSUMPTION: yes, 409 SESSION_ALREADY_STARTED (contract only blocks after ended) |
| 3 | Are the extra team endpoints (GET /sessions, GET /sessions/{code}, GET /sessions/{code}/players, PATCH /sessions/{code}, GET /sessions/{code}/questions/current) approved? | Endpoints 8-10, 12, 13, 15; 13 and 15 flagged |
| 4 | Bomb timer duration? | Default 30s via BOMB_TIMER_SECONDS |
| 5 | Final ranking formula? | Default: active first, score desc, penalties asc; eliminated after, latest eliminated higher |
