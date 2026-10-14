# Bomb Pass — API

Multiplayer question-based action game for the Library Game Hub (CS 313).
Players answer multiple-choice questions while passing a virtual bomb. When
the timer expires, the holder gets a penalty; at 3 penalties the player is
eliminated. The last active player wins. The server is authoritative for all
game state.

Built to Hub Contract v1. Frontend is next semester (not included).

## Quick start (local)

```bash
npm install
cp .env.example .env        # then edit .env
npm run migrate             # create the bomb_pass schema
npm run seed                # seed the host account (librarian / Librarian123!)
npm start                   # node server.js on http://localhost:3001
```

Then verify:

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/game-info
```

## Two deployment targets, same code

| Target | Entry point | Notes |
|--------|-------------|-------|
| **Library server (FINAL)** | `node server.js` | env `PORT` (default 3001), behind the hub forwarding `/games/bomb-pass/` |
| **Vercel + Neon (TEST)** | `/api/index.js` | serverless export; `vercel.json` routes `/api/*` and `/games/bomb-pass/api/*` |

The same Express router is mounted at BOTH `/api/v1` and
`/games/bomb-pass/api/v1`. The app is stateless: no in-memory game state, no
timers, no WebSockets. Expiration is lazy — every session request first runs
`SessionStateService.reconcile(code)` in a DB transaction, and clients poll
`GET /api/v1/sessions/{code}` every 1-2 s.

## Environment variables

See `.env.example`. Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Library server port |
| `DATABASE_URL` | — | PostgreSQL / Neon pooled connection string |
| `DB_SCHEMA` | `bomb_pass` | Schema name (set via `search_path`) |
| `JWT_SECRET` | dev fallback | **Required in production** |
| `HOST_TOKEN_TTL` | `8h` | Host JWT lifetime |
| `PLAYER_TOKEN_TTL` | `3h` | Player JWT lifetime (one session only) |
| `HUB_ORIGIN` | — | Allowed CORS origin (hub address) |
| `TEAM_NAME` / `SECTION` | `Bomb Pass Team` / `3-2` | game-info team field |
| `BOMB_TIMER_SECONDS` | `30` | Bomb countdown |
| `MAX_PLAYERS` | `30` | Session capacity |

## API overview (all under `/api/v1`)

| Method | URL | Auth |
|--------|-----|------|
| GET | `/health` | none |
| GET | `/game-info` | none |
| POST | `/auth/login` | none |
| POST | `/question-sets` | Host |
| GET | `/question-sets` | Host |
| GET | `/question-sets/{id}` | Host |
| POST | `/sessions` | Host |
| GET | `/sessions` | Host |
| GET | `/sessions/{code}` | none |
| PATCH | `/sessions/{code}` | Host |
| POST | `/sessions/{code}/players` | none |
| GET | `/sessions/{code}/players` | none |
| GET | `/sessions/{code}/questions/current` | Player |
| POST | `/sessions/{code}/answers` | Player |
| POST | `/sessions/{code}/bomb-passes` | Player |
| GET | `/sessions/{code}/leaderboard` | none |

Every error uses one format: `{ "error": { "code": "UPPER_SNAKE_CASE", "message": "..." } }`.

## curl examples

### Health and game info (no token)

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/game-info
```

### Host login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"librarian","password":"Librarian123!"}'
# → { "token": "...", "host_id": 1, "username": "librarian" }
```

### Create a question set (Rule 3 format)

```bash
curl -X POST http://localhost:3001/api/v1/question-sets \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "title": "Philippine Literature",
    "subject": "Literature",
    "questions": [{
      "text": "Who wrote Noli Me Tangere?",
      "type": "multiple_choice",
      "choices": ["Jose Rizal", "Andres Bonifacio", "Apolinario Mabini", "Emilio Aguinaldo"],
      "correct_index": 0,
      "time_limit_sec": 20
    }]
  }'
```

### Start a session

```bash
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"question_set_id": 1}'
# → { "id": 1, "join_code": "482913", "status": "waiting", ... }
```

### Join as a player

```bash
curl -X POST http://localhost:3001/api/v1/sessions/482913/players \
  -H 'Content-Type: application/json' -d '{"nickname":"PlayerOne"}'
# → { "id": 1, "nickname": "PlayerOne", "score": 0, "penalty_count": 0, "status": "active", "joined_at": "...", "token": "..." }
```

### Start the game (host)

```bash
curl -X PATCH http://localhost:3001/api/v1/sessions/482913 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"playing"}'
```

### Poll the session (drives lazy expiration)

```bash
curl http://localhost:3001/api/v1/sessions/482913
```

### Get the current question (player token)

```bash
curl http://localhost:3001/api/v1/sessions/482913/questions/current \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

### Submit an answer

```bash
curl -X POST http://localhost:3001/api/v1/sessions/482913/answers \
  -H "Authorization: Bearer $PLAYER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"question_id": 3, "choice_index": 0}'
# → { "correct": true, "score": 100, "rank": 1 }
```

### Pass the bomb

```bash
curl -X POST http://localhost:3001/api/v1/sessions/482913/bomb-passes \
  -H "Authorization: Bearer $PLAYER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"target_player_id": 2}'
# → { "new_holder_id": 2, "new_holder_nickname": "PlayerTwo", "timer_reset": true, "bomb_expires_at": "..." }
```

### Leaderboard

```bash
curl http://localhost:3001/api/v1/sessions/482913/leaderboard
```

### End the game (host)

```bash
curl -X PATCH http://localhost:3001/api/v1/sessions/482913 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"ended"}'
```

### Export a question set (downloads a JSON file)

```bash
curl -OJ http://localhost:3001/api/v1/question-sets/1/export \
  -H "Authorization: Bearer $TOKEN"
```

### Import a question set (from a Rule 3 JSON body)

```bash
curl -X POST http://localhost:3001/api/v1/question-sets/import \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d @question-set.json
```

### Copy a question set

```bash
curl -X POST http://localhost:3001/api/v1/question-sets/1/copy \
  -H "Authorization: Bearer $TOKEN"
```

### Session results (host review)

```bash
curl http://localhost:3001/api/v1/sessions/482913/results \
  -H "Authorization: Bearer $TOKEN"
```

### Leave the game (player forfeits)

```bash
curl -X DELETE http://localhost:3001/api/v1/sessions/482913/players/1 \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

## Testing

```bash
export TEST_DATABASE_URL=postgresql://user:password@host:5432/bomb_pass_test
npm test
```

Tests need a separate `bomb_pass_test` database (migrations run
automatically). Without `TEST_DATABASE_URL`, DB-backed suites skip and the
pure unit suites still run.

## Project structure

```
api/index.js            Vercel serverless entry point
server.js               Local/library server entry point (node server.js)
src/
  app.js                Express app (dual mount, CORS, thumbnail, error handler)
  config/               Env config + game-info validation + bad words
  routes/               URL mapping only
  controllers/          Input → service → JSON
  services/             All business rules (incl. SessionStateService, QuestionFlowService)
  repositories/         ALL SQL
  factories/            QuestionFactory (Rule 3 format)
  middleware/           Auth (JWT role), validation, error handler
  db/pool.js            Singleton pg Pool (search_path = bomb_pass)
  utils/                AppError, errorCodes, dates
db/
  migrations/001_init.sql
  seed/seed.js          Seeds one host (no registration endpoint)
  seed/generate-thumbnail.js
public/thumbnail.png    400x300 placeholder
tests/                  Unit, contract, and integration suites
docs/                   Design documents (updated for Hub Contract v1)
```

## Open Decisions

See **Open Decisions** at the end of `docs/09-consistency-check.md` for every
ASSUMPTION/TBD and the list of places the design docs previously disagreed
with the contract.
