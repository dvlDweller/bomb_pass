# API Endpoint Table — Bomb Pass

**Base URL:** `/api/v1` (also mounted at `/games/bomb-pass/api/v1`)

**Error format (Rule 4, all endpoints):** `{ "error": { "code": "UPPER_SNAKE_CASE", "message": "One plain sentence a player can understand." } }`

---

## Contract Error Codes (Rule 4)

| Status | Code | Meaning |
|--------|------|---------|
| 400 | VALIDATION_FAILED | Input failed validation |
| 400 | TARGET_ELIMINATED | Pass target is eliminated |
| 400 | CANNOT_PASS_TO_SELF | Pass target is the requester |
| 401 | AUTH_REQUIRED | No/invalid/expired token |
| 401 | INVALID_CREDENTIALS | Bad username/password or too many attempts |
| 403 | NOT_YOUR_QUESTION_SET | Set belongs to another host |
| 403 | NOT_YOUR_SESSION | Session belongs to another host |
| 403 | NOT_BOMB_HOLDER | Requester does not hold the bomb |
| 403 | PLAYER_ELIMINATED | Eliminated player cannot do this |
| 403 | WRONG_TOKEN_TYPE | Host token on player endpoint or vice versa |
| 404 | SESSION_NOT_FOUND | No session uses that join code |
| 404 | QUESTION_SET_NOT_FOUND | No question set with that id |
| 404 | PLAYER_NOT_FOUND | Player not in this session |
| 409 | NICKNAME_TAKEN | Nickname already used in this session |
| 409 | SESSION_ENDED | Session has ended |
| 409 | SESSION_ALREADY_STARTED | Session is already playing |
| 409 | SESSION_FULL | Session has 30 players |
| 409 | NOT_ENOUGH_PLAYERS | Fewer than 3 players |
| 409 | ALREADY_ANSWERED | Player already answered this question |
| 409 | NO_ACTIVE_QUESTION | No question is active right now |
| 409 | BOMB_EXPIRED | Bomb deadline already passed |
| 409 | NO_OTHER_ACTIVE_PLAYER | No one else to pass to |
| 500 | SERVER_ERROR | Unknown server error (generic message) |
| 503 | DATABASE_DOWN | Database unreachable |

---

## 1. Health Check

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/health` |
| **Auth** | None |
| **Use Case** | System health monitoring |
| **Success** | 200 |
| **Errors** | 503 |

**Success Response (200):**
```json
{ "status": "ok", "database": "ok", "time": "2026-10-05T09:00:00Z" }
```
Runs a real `SELECT 1`; `time` is ISO 8601 UTC.

**Error Response (503):**
```json
{ "error": { "code": "DATABASE_DOWN", "message": "The game service is temporarily unavailable." } }
```

---

## 2. Game Info

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/game-info` |
| **Auth** | None |
| **Use Case** | Client initialization |
| **Success** | 200 |
| **Errors** | 500 |

**Success Response (200):**
```json
{
  "slug": "bomb-pass",
  "name": "Bomb Pass",
  "team": "Bomb Pass Team (BSCS 3-2)",
  "description": "Answer questions and pass the bomb. When time runs out, the holder gets a penalty. Last player standing wins.",
  "min_players": 3,
  "max_players": 30,
  "thumbnail_url": "/games/bomb-pass/thumbnail.png",
  "play_url": "/games/bomb-pass/",
  "version": "1.0.0"
}
```
Validated on startup: slug lowercase-hyphens; name ≤ 40 chars; description one sentence ≤ 150 chars; version MAJOR.MINOR.PATCH. The 400×300 PNG thumbnail is served at `/games/bomb-pass/thumbnail.png` and `/thumbnail.png`.

---

## 3. Host Login

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/auth/login` |
| **Auth** | None |
| **Use Case** | UC-01: Host Login |
| **Success** | 200 |
| **Errors** | 400, 401 |

**Request Body:**
```json
{ "username": "librarian1", "password": "securepass123" }
```

**Success Response (200):**
```json
{ "token": "bearer_token_here", "host_id": 1, "username": "librarian1" }
```
JWT, TTL env `HOST_TOKEN_TTL` (default 8h).

**Error Responses:**
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Username and password are required." } }
```
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password." } }
```
Rate-limited via the `login_attempts` table (database, not in-memory); only a SHA-256 IP hash is stored.

---

## 4. Create Question Set

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/question-sets` |
| **Auth** | Host |
| **Use Case** | UC-02: Create Question Set |
| **Success** | 201 |
| **Errors** | 400, 401 |

**Request Body (Hub Contract v1 Rule 3 format):**
```json
{
  "title": "Philippine Literature",
  "description": "Questions about Philippine literature",
  "subject": "Literature",
  "grade_level": "Grade 11",
  "questions": [
    {
      "text": "Who wrote Noli Me Tangere?",
      "type": "multiple_choice",
      "choices": ["Jose Rizal", "Andres Bonifacio", "Apolinario Mabini", "Emilio Aguinaldo"],
      "correct_index": 0,
      "time_limit_sec": 20
    },
    {
      "text": "The sky is blue.",
      "type": "true_false",
      "choices": ["True", "False"],
      "correct_index": 0,
      "time_limit_sec": 10
    }
  ]
}
```
Validation (all in QuestionFactory): title 3-80 chars; 1-50 questions; multiple_choice = 2-4 choices, true_false = exactly 2; each choice 1-120 chars; correct_index whole number inside choices; time_limit_sec 5-60, default 20. Extra fields (e.g. `points`, default 100) are allowed; a set with only the contract fields is accepted.

**Success Response (201):** the stored set in the Rule 3 shape plus metadata:
```json
{
  "id": 1,
  "title": "Philippine Literature",
  "description": "Questions about Philippine literature",
  "subject": "Literature",
  "grade_level": "Grade 11",
  "question_count": 2,
  "created_at": "2026-10-05T09:00:00Z",
  "questions": [
    { "text": "Who wrote Noli Me Tangere?", "type": "multiple_choice", "choices": ["Jose Rizal", "Andres Bonifacio", "Apolinario Mabini", "Emilio Aguinaldo"], "time_limit_sec": 20 },
    { "text": "The sky is blue.", "type": "true_false", "choices": ["True", "False"], "time_limit_sec": 10 }
  ]
}
```

**Error Responses:**
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "A question set can have at most 50 questions." } }
```
```json
{ "error": { "code": "AUTH_REQUIRED", "message": "Please log in first." } }
```

---

## 5. List Question Sets

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/question-sets` |
| **Auth** | Host |
| **Use Case** | UC-13: Browse/Export Question Sets |
| **Success** | 200 |
| **Errors** | 401 |

**Success Response (200):** only the calling host's sets.
```json
[
  { "id": 1, "title": "Philippine Literature", "subject": "Literature", "grade_level": "Grade 11", "question_count": 2, "created_at": "2026-10-05T09:00:00Z" }
]
```

---

## 6. Get Question Set

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/question-sets/{id}` |
| **Auth** | Host |
| **Use Case** | UC-13: Browse/Export Question Sets |
| **Success** | 200 |
| **Errors** | 401, 403, 404 |

**Success Response (200):** full Rule 3 set including `correct_index` (host-only, so it can be exported/imported):
```json
{
  "id": 1,
  "title": "Philippine Literature",
  "description": "Questions about Philippine literature",
  "subject": "Literature",
  "grade_level": "Grade 11",
  "question_count": 2,
  "created_at": "2026-10-05T09:00:00Z",
  "questions": [
    { "text": "Who wrote Noli Me Tangere?", "type": "multiple_choice", "choices": ["Jose Rizal", "Andres Bonifacio", "Apolinario Mabini", "Emilio Aguinaldo"], "correct_index": 0, "time_limit_sec": 20 },
    { "text": "The sky is blue.", "type": "true_false", "choices": ["True", "False"], "correct_index": 0, "time_limit_sec": 10 }
  ]
}
```

**Error Responses:**
```json
{ "error": { "code": "NOT_YOUR_QUESTION_SET", "message": "That question set belongs to another host." } }
```
```json
{ "error": { "code": "QUESTION_SET_NOT_FOUND", "message": "No question set exists with that id." } }
```

---

## 7. Start Session

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/sessions` |
| **Auth** | Host |
| **Use Case** | UC-03: Start Game Session |
| **Success** | 201 |
| **Errors** | 400, 401, 403, 404 |

**Request Body:**
```json
{ "question_set_id": 1 }
```

**Success Response (201):**
```json
{ "id": 1, "join_code": "482913", "status": "waiting", "question_set_id": 1, "created_at": "2026-10-05T09:05:00Z" }
```
Join code is server-generated: exactly 6 digits, never starts with 0, unique among open sessions (retry on collision).

**Error Responses:**
```json
{ "error": { "code": "NOT_YOUR_QUESTION_SET", "message": "That question set belongs to another host." } }
```
```json
{ "error": { "code": "QUESTION_SET_NOT_FOUND", "message": "No question set exists with that id." } }
```

---

## 8. List My Sessions

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions` |
| **Auth** | Host |
| **Use Case** | UC-04: View Game Results |
| **Success** | 200 |
| **Errors** | 401 |

**Success Response (200):**
```json
[
  { "id": 1, "join_code": "482913", "status": "ended", "created_at": "2026-10-05T09:05:00Z", "ended_at": "2026-10-05T09:20:00Z", "winner_nickname": "PlayerTwo" }
]
```

---

## 9. Get Session Details

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions/{code}` |
| **Auth** | None |
| **Use Case** | UC-05: Join Session (validation), client polling |
| **Success** | 200 |
| **Errors** | 404 |

**Success Response (200):** always reconciles first.
```json
{
  "id": 1,
  "join_code": "482913",
  "status": "playing",
  "player_count": 5,
  "bomb_holder_id": 2,
  "bomb_holder_nickname": "PlayerOne",
  "bomb_expires_at": "2026-10-05T09:10:30Z",
  "question_expires_at": "2026-10-05T09:10:20Z",
  "server_time": "2026-10-05T09:10:00Z",
  "winner_nickname": null
}
```
`server_time` lets clients compute countdowns despite clock skew.

**Error Response:**
```json
{ "error": { "code": "SESSION_NOT_FOUND", "message": "No game uses the join code 999999." } }
```

---

## 10. Update Session Status

| Field | Value |
|-------|-------|
| **Method** | PATCH |
| **URL** | `/api/v1/sessions/{code}` |
| **Auth** | Host |
| **Use Case** | UC-03: Start Game Session, UC-04: End Game Session |
| **Success** | 200 |
| **Errors** | 400, 401, 403, 404, 409 |

**Request Body (start):**
```json
{ "status": "playing" }
```

**Success Response (200):** the session view (same shape as endpoint 9, status `playing`, `bomb_holder_nickname` and `bomb_expires_at` set, first question active).

**Request Body (end):**
```json
{ "status": "ended" }
```

**Rules:** creating host only (403 NOT_YOUR_SESSION). Starting: must be `waiting`, needs ≥ 3 players (409 NOT_ENOUGH_PLAYERS); sets `playing`, random first bomb holder, `bomb_expires_at` = now + timer, first question + `question_expires_at`. Ending: must be `playing`; sets `ended`, `ended_at`, writes the final leaderboard.

**Error Responses:**
```json
{ "error": { "code": "NOT_ENOUGH_PLAYERS", "message": "At least 3 players are needed to start the game." } }
```
```json
{ "error": { "code": "SESSION_ALREADY_STARTED", "message": "This game is already running." } }
```

---

## 11. Join Session

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/sessions/{code}/players` |
| **Auth** | None |
| **Use Case** | UC-05: Join Session |
| **Success** | 201 |
| **Errors** | 400, 404, 409 |

**Request Body:**
```json
{ "nickname": "PlayerOne" }
```

**Success Response (201):**
```json
{
  "id": 1,
  "nickname": "PlayerOne",
  "score": 0,
  "penalty_count": 0,
  "status": "active",
  "joined_at": "2026-10-05T09:06:00Z",
  "token": "player_jwt_here"
}
```
Player token: 3 hours, valid for ONE session only, encodes player_id + session_id + role.

**Error Responses:**
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Nickname must be 2-20 characters." } }
```
```json
{ "error": { "code": "SESSION_NOT_FOUND", "message": "No game uses the join code 999999." } }
```
```json
{ "error": { "code": "NICKNAME_TAKEN", "message": "That nickname is already taken in this game." } }
```
```json
{ "error": { "code": "SESSION_ENDED", "message": "This game has already ended." } }
```
```json
{ "error": { "code": "SESSION_ALREADY_STARTED", "message": "This game has already started and cannot accept new players." } }
```
```json
{ "error": { "code": "SESSION_FULL", "message": "This game is full." } }
```

---

## 12. List Players in Session

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions/{code}/players` |
| **Auth** | None |
| **Use Case** | UC-08: View Leaderboard |
| **Success** | 200 |
| **Errors** | 404 |

**Success Response (200):**
```json
[
  { "id": 1, "nickname": "PlayerOne", "score": 100, "penalty_count": 0, "status": "active" },
  { "id": 2, "nickname": "PlayerTwo", "score": 200, "penalty_count": 1, "status": "active" }
]
```

---

## 13. Get Current Question

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions/{code}/questions/current` |
| **Auth** | Player |
| **Use Case** | UC-14: Get Current Question |
| **Success** | 200 |
| **Errors** | 401, 403, 404, 409 |

**Success Response (200):** NEVER includes `correct_index`.
```json
{
  "question_id": 3,
  "text": "Who wrote Noli Me Tangere?",
  "type": "multiple_choice",
  "choices": [
    { "choice_index": 0, "choice_text": "Jose Rizal" },
    { "choice_index": 1, "choice_text": "Andres Bonifacio" },
    { "choice_index": 2, "choice_text": "Apolinario Mabini" },
    { "choice_index": 3, "choice_text": "Emilio Aguinaldo" }
  ],
  "time_limit_sec": 20,
  "question_expires_at": "2026-10-05T09:10:20Z",
  "points": 100
}
```

**Error Responses:**
```json
{ "error": { "code": "NO_ACTIVE_QUESTION", "message": "There is no active question right now." } }
```
```json
{ "error": { "code": "WRONG_TOKEN_TYPE", "message": "A player token is required here." } }
```

---

## 14. Submit Answer

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/sessions/{code}/answers` |
| **Auth** | Player |
| **Use Case** | UC-06: Submit Answer |
| **Success** | 201 |
| **Errors** | 400, 401, 403, 404, 409 |

**Request Body:**
```json
{ "question_id": 3, "choice_index": 1 }
```

**Success Response (201):**
```json
{ "correct": true, "score": 100, "rank": 1 }
```
`score` = sum of points of the player's correct answers. The correct answer is never returned — only the boolean.

**Error Responses:**
```json
{ "error": { "code": "ALREADY_ANSWERED", "message": "You have already answered this question." } }
```
```json
{ "error": { "code": "NO_ACTIVE_QUESTION", "message": "That question is no longer active." } }
```
```json
{ "error": { "code": "SESSION_ENDED", "message": "This game has already ended." } }
```
```json
{ "error": { "code": "PLAYER_ELIMINATED", "message": "Eliminated players cannot answer questions." } }
```
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "choice_index must be a whole number between 0 and 3." } }
```
The token's session must match `{code}` (else 401 AUTH_REQUIRED / 403 WRONG_TOKEN_TYPE).

---

## 15. Pass Bomb

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/sessions/{code}/bomb-passes` |
| **Auth** | Player |
| **Use Case** | UC-07: Pass Bomb |
| **Success** | 200 |
| **Errors** | 400, 401, 403, 404, 409 |

**Request Body:**
```json
{ "target_player_id": 2 }
```

**Success Response (200):**
```json
{ "new_holder_id": 2, "new_holder_nickname": "PlayerTwo", "timer_reset": true, "bomb_expires_at": "2026-10-05T09:10:30Z" }
```

**Rules:** requester is the current holder (403 NOT_BOMB_HOLDER); target exists in this session (404 PLAYER_NOT_FOUND); target active (400 TARGET_ELIMINATED); target ≠ self (400 CANNOT_PASS_TO_SELF); session playing and deadline not passed (409 BOMB_EXPIRED / SESSION_ENDED, after reconcile); another active player exists (409 NO_OTHER_ACTIVE_PLAYER). Atomic via a row lock; in a race the loser gets 403 NOT_BOMB_HOLDER.

**Error Responses:**
```json
{ "error": { "code": "NOT_BOMB_HOLDER", "message": "Only the player holding the bomb can pass it." } }
```
```json
{ "error": { "code": "TARGET_ELIMINATED", "message": "That player has been eliminated." } }
```
```json
{ "error": { "code": "CANNOT_PASS_TO_SELF", "message": "You cannot pass the bomb to yourself." } }
```
```json
{ "error": { "code": "BOMB_EXPIRED", "message": "The bomb has already exploded." } }
```
```json
{ "error": { "code": "NO_OTHER_ACTIVE_PLAYER", "message": "There is no other player to pass the bomb to." } }
```

---

## 16. Get Leaderboard

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions/{code}/leaderboard` |
| **Auth** | None |
| **Use Case** | UC-08: View Leaderboard |
| **Success** | 200 |
| **Errors** | 404 |

**Success Response (200):** works during and after the game.
```json
[
  { "rank": 1, "nickname": "PlayerTwo", "score": 200, "penalty_count": 1, "status": "active" },
  { "rank": 2, "nickname": "PlayerOne", "score": 100, "penalty_count": 0, "status": "active" }
]
```

---

## 6b. Export Question Set

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/question-sets/{id}/export` |
| **Auth** | Host |
| **Use Case** | UC-13: Browse/Export Question Sets |
| **Success** | 200 |
| **Errors** | 401, 403, 404 |

**Success Response (200):** the full Rule 3 set (with `correct_index`) and a `Content-Disposition: attachment; filename="question-set-{id}.json"` header so the browser downloads it as a file. Same shape as endpoint 6.

---

## 4b. Import Question Set

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/question-sets/import` |
| **Auth** | Host |
| **Use Case** | UC-13: Browse/Export Question Sets |
| **Success** | 201 |
| **Errors** | 400, 401 |

**Request Body:** the Rule 3 set JSON (same as endpoint 4). Creates a new set owned by the calling host. **Success Response (201):** same as endpoint 4.

---

## 6c. Copy Question Set

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/v1/question-sets/{id}/copy` |
| **Auth** | Host |
| **Use Case** | UC-13: Browse/Export Question Sets |
| **Success** | 201 |
| **Errors** | 401, 403, 404 |

**Success Response (201):** a duplicate of the set with `" (copy)"` appended to the title (truncated to stay within 80 chars). The copy is independent of the original.

---

## 9b. Get Session Results

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/v1/sessions/{code}/results` |
| **Auth** | Host |
| **Use Case** | UC-04: View Game Results |
| **Success** | 200 |
| **Errors** | 401, 403, 404 |

**Success Response (200):** session metadata + final rankings for the host's later review.
```json
{
  "id": 1,
  "join_code": "482913",
  "status": "ended",
  "player_count": 3,
  "started_at": "2026-10-05T09:10:00Z",
  "ended_at": "2026-10-05T09:20:00Z",
  "winner_nickname": "PlayerTwo",
  "rankings": [
    { "rank": 1, "nickname": "PlayerTwo", "score": 200, "penalty_count": 1, "status": "active" }
  ]
}
```
Creating host only (403 NOT_YOUR_SESSION otherwise).

---

## 12b. Leave Game (Forfeit)

| Field | Value |
|-------|-------|
| **Method** | DELETE |
| **URL** | `/api/v1/sessions/{code}/players/{id}` |
| **Auth** | Player (self) |
| **Use Case** | UC-05: Join Session (leave) |
| **Success** | 200 |
| **Errors** | 401, 403, 404, 409 |

**Success Response (200):** `{ "id": 1, "status": "eliminated" }`. The player is marked eliminated (kept in the record for results). If they held the bomb, it is reassigned; if one active player remains, the game ends. The token's player must match `{id}` (403 otherwise). Ended session → 409 SESSION_ENDED.

---

## Endpoint Summary

| # | Method | URL | Auth | Type | Use Case | Success | Errors |
|---|--------|-----|------|------|----------|---------|--------|
| 1 | GET | `/api/v1/health` | None | Hub | — | 200 | 503 |
| 2 | GET | `/api/v1/game-info` | None | Hub | — | 200 | 500 |
| 3 | POST | `/api/v1/auth/login` | None | Hub | UC-01 | 200 | 400, 401 |
| 4 | POST | `/api/v1/question-sets` | Host | Hub | UC-02 | 201 | 400, 401 |
| 5 | GET | `/api/v1/question-sets` | Host | Team | UC-13 | 200 | 401 |
| 6 | GET | `/api/v1/question-sets/{id}` | Host | Team | UC-13 | 200 | 401, 403, 404 |
| 7 | POST | `/api/v1/sessions` | Host | Hub | UC-03 | 201 | 400, 401, 403, 404 |
| 8 | GET | `/api/v1/sessions` | Host | Team | UC-04 | 200 | 401 |
| 9 | GET | `/api/v1/sessions/{code}` | None | Team | UC-05 | 200 | 404 |
| 10 | PATCH | `/api/v1/sessions/{code}` | Host | Team | UC-03, UC-04 | 200 | 400, 401, 403, 404, 409 |
| 11 | POST | `/api/v1/sessions/{code}/players` | None | Hub | UC-05 | 201 | 400, 404, 409 |
| 12 | GET | `/api/v1/sessions/{code}/players` | None | Team | UC-08 | 200 | 404 |
| 13 | GET | `/api/v1/sessions/{code}/questions/current` | Player | Team | UC-14 | 200 | 401, 403, 404, 409 |
| 14 | POST | `/api/v1/sessions/{code}/answers` | Player | Hub | UC-06 | 201 | 400, 401, 403, 404, 409 |
| 15 | POST | `/api/v1/sessions/{code}/bomb-passes` | Player | Team | UC-07 | 200 | 400, 401, 403, 404, 409 |
| 16 | GET | `/api/v1/sessions/{code}/leaderboard` | None | Hub | UC-08 | 200 | 404 |
| 17 | GET | `/api/v1/question-sets/{id}/export` | Host | Team | UC-13 | 200 | 401, 403, 404 |
| 18 | POST | `/api/v1/question-sets/import` | Host | Team | UC-13 | 201 | 400, 401 |
| 19 | POST | `/api/v1/question-sets/{id}/copy` | Host | Team | UC-13 | 201 | 401, 403, 404 |
| 20 | GET | `/api/v1/sessions/{code}/results` | Host | Team | UC-04 | 200 | 401, 403, 404 |
| 21 | DELETE | `/api/v1/sessions/{code}/players/{id}` | Player | Team | UC-05 | 200 | 401, 403, 404, 409 |
