# Use Case Diagram + Narratives — Bomb Pass

## Use Case Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      BOMB PASS SYSTEM                        │
│                                                             │
│  ┌──────────┐                                               │
│  │   HOST   │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ├─── (UC-01) Host Login                               │
│       ├─── (UC-02) Create Question Set                      │
│       ├─── (UC-03) Start Game Session                       │
│       ├─── (UC-04) View Game Results                        │
│       ├─── (UC-13) Browse/Export Question Sets              │
│       └─── (UC-14) Get Current Question                     │
│                                                             │
│  ┌──────────┐                                               │
│  │  PLAYER  │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ├─── (UC-05) Join Session                             │
│       ├─── (UC-06) Submit Answer                            │
│       ├─── (UC-07) Pass Bomb                                │
│       └─── (UC-08) View Leaderboard                         │
│                                                             │
│  ┌──────────┐                                               │
│  │  SYSTEM  │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ├─── (UC-09) Generate Join Code                       │
│       ├─── (UC-10) Validate Answer                          │
│       ├─── (UC-11) Process Bomb Expiration (lazy reconcile)  │
│       └─── (UC-12) Update Leaderboard                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## UC-05: Join Session

| Field | Value |
|-------|-------|
| **Use Case ID** | UC-05 |
| **Name** | Join Session |
| **Actor** | Player |
| **Goal** | Join a game session using a 6-digit code and nickname |
| **Preconditions** | A game session exists with the given join code; session is in "waiting" status |
| **Main Flow** | 1. Player enters 6-digit join code and nickname (2-20 chars, bad-word filtered)<br>2. Server validates the join code exists<br>3. Server validates the nickname is unique within the session<br>4. Server creates a player record<br>5. Server returns player confirmation and a player token (3h, this session only) |
| **Alternative Flow** | 2a. Join code does not exist → 404 SESSION_NOT_FOUND<br>3a. Nickname already taken → 409 NICKNAME_TAKEN |
| **Exceptions** | Invalid join code format (not 6 digits) → 400 VALIDATION_FAILED; nickname fails rules → 400 VALIDATION_FAILED; session playing → 409 SESSION_ALREADY_STARTED; session ended → 409 SESSION_ENDED; session full → 409 SESSION_FULL |
| **Postconditions** | Player is added to the session; player receives a player token |
| **Related User Story** | US-P01 |
| **Related API Endpoint** | `POST /api/v1/sessions/{code}/players` |

---

## UC-06: Submit Answer

| Field | Value |
|-------|-------|
| **Use Case ID** | UC-06 |
| **Name** | Submit Answer |
| **Actor** | Player |
| **Goal** | Submit an answer choice to the current question |
| **Preconditions** | Player has joined a session; session is in "playing" status; a question is active |
| **Main Flow** | 1. Player selects an answer choice<br>2. Player submits answer with question_id and choice_index<br>3. Server validates the player is in the session (token session matches)<br>4. Server validates the question is the active question<br>5. Server checks if answer is correct (without revealing correct answer)<br>6. Server records the answer and updates the player's score<br>7. Server returns `{correct, score, rank}` |
| **Alternative Flow** | 3a. Player not in session / wrong token → 401 AUTH_REQUIRED or 403 WRONG_TOKEN_TYPE<br>4a. No active question → 409 NO_ACTIVE_QUESTION<br>5a. Answer already submitted for this question → 409 ALREADY_ANSWERED |
| **Exceptions** | Invalid question_id → 400 VALIDATION_FAILED; invalid choice_index → 400 VALIDATION_FAILED; eliminated player → 403 PLAYER_ELIMINATED; session ended → 409 SESSION_ENDED |
| **Postconditions** | Answer is recorded; player receives correctness feedback, score, and rank |
| **Related User Story** | US-P03 |
| **Related API Endpoint** | `POST /api/v1/sessions/{code}/answers` |

---

## UC-07: Pass Bomb

| Field | Value |
|-------|-------|
| **Use Case ID** | UC-07 |
| **Name** | Pass Bomb |
| **Actor** | Player (current bomb holder) |
| **Goal** | Pass the virtual bomb to another active player |
| **Preconditions** | Player is the current bomb holder; session is in "playing" status; at least one other active player exists |
| **Main Flow** | 1. Bomb holder selects a target player<br>2. Bomb holder confirms the pass<br>3. Server reconciles the session first (lazy expiration)<br>4. Server validates the requester is the current bomb holder<br>5. Server validates the target player is active<br>6. Server validates the target is not the current holder<br>7. Server updates the bomb holder to the target player (atomic via row lock)<br>8. Server resets the bomb timer<br>9. Server confirms the pass with `{new_holder_id, new_holder_nickname, timer_reset, bomb_expires_at}` |
| **Alternative Flow** | 4a. Requester is not the bomb holder → 403 NOT_BOMB_HOLDER<br>5a. Target player is eliminated → 400 TARGET_ELIMINATED<br>6a. Target is the current holder → 400 CANNOT_PASS_TO_SELF |
| **Exceptions** | No other active players → 409 NO_OTHER_ACTIVE_PLAYER; bomb deadline passed → 409 BOMB_EXPIRED; session ended → 409 SESSION_ENDED; two passes race → loser gets 403 NOT_BOMB_HOLDER |
| **Postconditions** | Bomb holder is updated; timer is reset; all players notified of new holder |
| **Related User Story** | US-P04 |
| **Related API Endpoint** | `POST /api/v1/sessions/{code}/bomb-passes` |

---

## UC-13: Browse/Export Question Sets

| Field | Value |
|-------|-------|
| **Use Case ID** | UC-13 |
| **Name** | Browse/Export Question Sets |
| **Actor** | Host |
| **Goal** | List my question sets and export one as JSON so it can be reused or imported into another game |
| **Preconditions** | Host is logged in |
| **Main Flow** | 1. Host requests the list of their question sets<br>2. Server returns summaries (id, title, subject, grade_level, question_count, created_at)<br>3. Host requests one set by id<br>4. Server returns the full Rule 3 set including correct_index |
| **Alternative Flow** | 3a. Set belongs to another host → 403 NOT_YOUR_QUESTION_SET<br>3b. Set does not exist → 404 QUESTION_SET_NOT_FOUND |
| **Exceptions** | Not logged in → 401 AUTH_REQUIRED |
| **Postconditions** | Host can copy the Rule 3 JSON and re-import it via POST /question-sets |
| **Related User Story** | US-H07, US-H08 |
| **Related API Endpoint** | `GET /api/v1/question-sets`, `GET /api/v1/question-sets/{id}` |

---

## UC-14: Get Current Question

| Field | Value |
|-------|-------|
| **Use Case ID** | UC-14 |
| **Name** | Get Current Question |
| **Actor** | Player |
| **Goal** | Receive the active question with its choices so I can answer it |
| **Preconditions** | Player has joined a session; session is in "playing" status |
| **Main Flow** | 1. Player requests the current question<br>2. Server returns `{question_id, text, type, choices:[{choice_index, choice_text}], time_limit_sec, question_expires_at, points}` |
| **Alternative Flow** | 2a. Session not playing → 409 NO_ACTIVE_QUESTION |
| **Exceptions** | Not joined / wrong token → 401 AUTH_REQUIRED or 403 WRONG_TOKEN_TYPE; unknown code → 404 SESSION_NOT_FOUND |
| **Postconditions** | Player can render the question and choices; correct_index is never included |
| **Related User Story** | US-P02 |
| **Related API Endpoint** | `GET /api/v1/sessions/{code}/questions/current` |
