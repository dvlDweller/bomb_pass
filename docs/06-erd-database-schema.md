# ERD + Database Schema + Data Dictionary — Bomb Pass

**Database:** PostgreSQL (Neon for the test deploy) · **Schema:** `bomb_pass` (env `DB_SCHEMA`, set via `search_path`)

## Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    hosts     │       │ question_sets│       │   questions  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │──┐    │ id (PK)      │
│ username     │  │    │ host_id (FK) │  │    │ question_set │
│ password_hash│  │    │ title        │  │    │ _id (FK)     │
│ created_at   │  │    │ description  │  │    │ position     │
└──────────────┘  │    │ subject      │  │    │ text         │
                  │    │ grade_level  │  │    │ type         │
                  │    │ created_at   │  │    │ correct_index│
                  │    └──────────────┘  │    │ time_limit   │
                  │                      │    │ _sec         │
                  │                      │    │ points       │
                  │                      │    └──────┬───────┘
                  │                      │           │ 1
                  │                      │           │
                  │                      │           │ 2..4
                  │                      │    ┌──────┴───────┐
                  │                      │    │   choices    │
                  │                      │    ├──────────────┤
                  │                      │    │ id (PK)      │
                  │                      │    │ question_id  │
                  │                      │    │ (FK)         │
                  │                      │    │ choice_index │
                  │                      │    │ choice_text  │
                  │                      │    └──────────────┘
                  │                      │
                  │    ┌──────────────┐  │    ┌──────────────┐
                  │    │   sessions   │  │    │   players    │
                  │    ├──────────────┤  │    ├──────────────┤
                  │    │ id (PK)      │  │    │ id (PK)      │
                  │    │ host_id (FK) │  │    │ session_id   │
                  │    │ question_set │  │    │ (FK)         │
                  │    │ _id (FK)     │  │    │ nickname     │
                  │    │ join_code    │  │    │ score        │
                  │    │ status       │  │    │ penalty_count│
                  │    │ bomb_holder  │  │    │ status       │
                  │    │ _id (FK)     │  │    │ eliminated_at│
                  │    │ bomb_expires │  │    │ joined_at    │
                  │    │ _at          │  │    └──────────────┘
                  │    │ current_     │  │
                  │    │ question_id  │  │    ┌──────────────┐
                  │    │ question_     │  │    │   answers    │
                  │    │ expires_at   │  │    ├──────────────┤
                  │    │ winner_      │  │    │ id (PK)      │
                  │    │ player_id    │  │    │ session_id   │
                  │    │ started_at   │  │    │ (FK)         │
                  │    │ ended_at     │  │    │ player_id    │
                  │    │ created_at   │  │    │ (FK)         │
                  │    └──────────────┘  │    │ question_id  │
                  │                      │    │ (FK)         │
                  │                      │    │ choice_index │
                  │                      │    │ is_correct   │
                  │                      │    │ submitted_at │
                  │                      │    └──────────────┘
                  │                      │
                  │                      │    ┌──────────────┐
                  │                      │    │   penalties  │
                  │                      │    ├──────────────┤
                  │                      │    │ id (PK)      │
                  │                      │    │ player_id    │
                  │                      │    │ (FK)         │
                  │                      │    │ session_id   │
                  │                      │    │ (FK)         │
                  │                      │    │ reason       │
                  │                      │    │ created_at   │
                  │                      │    └──────────────┘
                  │                      │
                  │                      │    ┌──────────────┐
                  │                      │    │ leaderboards │
                  │                      │    ├──────────────┤
                  │                      │    │ id (PK)      │
                  │                      │    │ session_id   │
                  │                      │    │ (FK, UNIQUE) │
                  │                      │    │ rankings     │
                  │                      │    │ updated_at   │
                  │                      │    └──────────────┘
                  │                      │
                  │                      │    ┌──────────────┐
                  │                      │    │login_attempts│
                  │                      │    ├──────────────┤
                  │                      │    │ id (PK)      │
                  │                      │    │ username     │
                  │                      │    │ ip_hash      │
                  │                      │    │ attempted_at │
                  │                      │    └──────────────┘
```

## Database Schema

### Table: hosts

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| username | VARCHAR(50) | NOT NULL | | Unique username |
| password_hash | VARCHAR(255) | NOT NULL | | bcrypt hash, never plain text |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Account creation time |

### Table: login_attempts

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| username | VARCHAR(50) | NOT NULL | | Username attempted |
| ip_hash | VARCHAR(64) | NULL | | SHA-256 hash of the IP, never the IP itself |
| attempted_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Attempt time |

Index: `idx_login_attempts_username_time (username, attempted_at)`. Used for DB-based login rate limiting (hosts only; players are never tracked).

### Table: question_sets

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| host_id | INT | NOT NULL | | FK to hosts.id ON DELETE CASCADE |
| title | VARCHAR(80) | NOT NULL | | Question set title (3-80 chars) |
| description | VARCHAR(500) | NULL | | Optional description |
| subject | VARCHAR(100) | NULL | | Optional subject |
| grade_level | VARCHAR(50) | NULL | | Optional grade level |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Creation time |

### Table: questions

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| question_set_id | INT | NOT NULL | | FK to question_sets.id ON DELETE CASCADE |
| position | INT | NOT NULL | 0 | Order within the set |
| text | TEXT | NOT NULL | | The question text |
| type | VARCHAR(20) | NOT NULL | 'multiple_choice' | CHECK IN ('multiple_choice','true_false') |
| correct_index | INT | NOT NULL | | Index of the correct choice. **Server-only, never sent to players.** |
| time_limit_sec | INT | NOT NULL | 20 | CHECK 5-60; answer window in seconds |
| points | INT | NOT NULL | 100 | Points for a correct answer |

### Table: choices

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| question_id | INT | NOT NULL | | FK to questions.id ON DELETE CASCADE |
| choice_index | INT | NOT NULL | | 0-based position |
| choice_text | VARCHAR(120) | NOT NULL | | Choice text (1-120 chars) |

Constraint: `UNIQUE (question_id, choice_index)`.

### Table: sessions

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| host_id | INT | NOT NULL | | FK to hosts.id |
| question_set_id | INT | NOT NULL | | FK to question_sets.id |
| join_code | CHAR(6) | NOT NULL | | 6-digit code, CHECK ~ '^[1-9][0-9]{5}$' (never starts with 0) |
| status | VARCHAR(20) | NOT NULL | 'waiting' | CHECK IN ('waiting','playing','ended') |
| bomb_holder_id | INT | NULL | | FK to players.id (current bomb holder) |
| bomb_expires_at | TIMESTAMPTZ | NULL | | Bomb deadline; passing resets it |
| current_question_id | INT | NULL | | FK to questions.id |
| question_expires_at | TIMESTAMPTZ | NULL | | Answer window deadline (start + time_limit_sec) |
| winner_player_id | INT | NULL | | FK to players.id |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Session creation time |
| started_at | TIMESTAMPTZ | NULL | | When the host started the game |
| ended_at | TIMESTAMPTZ | NULL | | When the game ended |

Indexes: partial unique `idx_sessions_open_join_code (join_code) WHERE status <> 'ended'` (codes unique among open sessions); `idx_sessions_host`, `idx_sessions_question_set`, `idx_sessions_status`.

### Table: players

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| session_id | INT | NOT NULL | | FK to sessions.id ON DELETE CASCADE |
| nickname | VARCHAR(20) | NOT NULL | | 2-20 chars, bad-word filtered |
| score | INT | NOT NULL | 0 | Sum of points of correct answers |
| penalty_count | INT | NOT NULL | 0 | CHECK 0-3; eliminated at 3 |
| status | VARCHAR(20) | NOT NULL | 'active' | CHECK IN ('active','eliminated') |
| eliminated_at | TIMESTAMPTZ | NULL | | Elimination time |
| joined_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Join time |

Constraint: `UNIQUE (session_id, nickname)`.

### Table: answers

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| session_id | INT | NOT NULL | | FK to sessions.id |
| player_id | INT | NOT NULL | | FK to players.id |
| question_id | INT | NOT NULL | | FK to questions.id |
| choice_index | INT | NOT NULL | | Player's chosen index |
| is_correct | BOOLEAN | NOT NULL | | Server-determined correctness |
| submitted_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Submission time |

Constraint: `UNIQUE (player_id, question_id)`.

### Table: penalties

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| player_id | INT | NOT NULL | | FK to players.id |
| session_id | INT | NOT NULL | | FK to sessions.id |
| reason | VARCHAR(255) | NOT NULL | 'bomb_expiration' | Reason for the penalty |
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Penalty time |

### Table: leaderboards

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| id | SERIAL | NOT NULL | | Primary key |
| session_id | INT | NOT NULL | UNIQUE | FK to sessions.id |
| rankings | JSONB | NOT NULL | | JSON array of player rankings |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP | Last update time |

## Rule 3 Mapping

The Hub Contract v1 Rule 3 JSON is mapped to `questions` + `choices` by `QuestionFactory` and reassembled on export:

| Rule 3 JSON field | Database location |
|-------------------|-------------------|
| `title`, `description`, `subject`, `grade_level` | `question_sets.title`, `.description`, `.subject`, `.grade_level` |
| `questions[].text` | `questions.text` |
| `questions[].type` | `questions.type` |
| `questions[].position` (array order) | `questions.position` |
| `questions[].correct_index` | `questions.correct_index` (server-only) |
| `questions[].time_limit_sec` | `questions.time_limit_sec` |
| `questions[].points` (extra field, default 100) | `questions.points` |
| `questions[].choices[]` (array of strings) | `choices.choice_text` at `choices.choice_index` = array position |

## Data Dictionary

| Table | Column | Data Type | Description |
|-------|--------|-----------|-------------|
| hosts | id | SERIAL | Unique identifier for each host account |
| hosts | username | VARCHAR(50) | Host's login username (unique) |
| hosts | password_hash | VARCHAR(255) | bcrypt hash of the host password |
| hosts | created_at | TIMESTAMPTZ | When the host account was created |
| login_attempts | id | SERIAL | Unique identifier for each login attempt |
| login_attempts | username | VARCHAR(50) | Username that was attempted |
| login_attempts | ip_hash | VARCHAR(64) | SHA-256 hash of the source IP (privacy) |
| login_attempts | attempted_at | TIMESTAMPTZ | When the attempt happened |
| question_sets | id | SERIAL | Unique identifier for each question set |
| question_sets | host_id | INT | Reference to the host who created the set |
| question_sets | title | VARCHAR(80) | Display title (3-80 chars) |
| question_sets | description | VARCHAR(500) | Optional description |
| question_sets | subject | VARCHAR(100) | Optional subject |
| question_sets | grade_level | VARCHAR(50) | Optional grade level |
| question_sets | created_at | TIMESTAMPTZ | When the set was created |
| questions | id | SERIAL | Unique identifier for each question |
| questions | question_set_id | INT | Reference to the parent question set |
| questions | position | INT | Order of the question within the set |
| questions | text | TEXT | The question text shown to players |
| questions | type | VARCHAR(20) | multiple_choice or true_false |
| questions | correct_index | INT | Index of the correct choice. Server-only, never sent to players. |
| questions | time_limit_sec | INT | Answer window in seconds (5-60, default 20) |
| questions | points | INT | Points for a correct answer (default 100) |
| choices | id | SERIAL | Unique identifier for each choice |
| choices | question_id | INT | Reference to the parent question |
| choices | choice_index | INT | 0-based position of the choice |
| choices | choice_text | VARCHAR(120) | The choice text (1-120 chars) |
| sessions | id | SERIAL | Unique identifier for each game session |
| sessions | host_id | INT | Reference to the host who started the session |
| sessions | question_set_id | INT | Reference to the selected question set |
| sessions | join_code | CHAR(6) | 6-digit join code, never starts with 0 |
| sessions | status | VARCHAR(20) | waiting, playing, or ended |
| sessions | bomb_holder_id | INT | Reference to the player currently holding the bomb |
| sessions | bomb_expires_at | TIMESTAMPTZ | Bomb countdown deadline |
| sessions | current_question_id | INT | Reference to the active question |
| sessions | question_expires_at | TIMESTAMPTZ | Answer window deadline |
| sessions | winner_player_id | INT | Reference to the winning player |
| sessions | created_at | TIMESTAMPTZ | When the session was created |
| sessions | started_at | TIMESTAMPTZ | When the host started the game |
| sessions | ended_at | TIMESTAMPTZ | When the game ended |
| players | id | SERIAL | Unique identifier for each player |
| players | session_id | INT | Reference to the joined session |
| players | nickname | VARCHAR(20) | Player's display name (2-20 chars) |
| players | score | INT | Sum of points of the player's correct answers |
| players | penalty_count | INT | Number of penalties received (0-3) |
| players | status | VARCHAR(20) | active or eliminated |
| players | eliminated_at | TIMESTAMPTZ | When the player was eliminated |
| players | joined_at | TIMESTAMPTZ | When the player joined |
| answers | id | SERIAL | Unique identifier for each answer |
| answers | session_id | INT | Reference to the session |
| answers | player_id | INT | Reference to the answering player |
| answers | question_id | INT | Reference to the question |
| answers | choice_index | INT | Player's chosen answer index |
| answers | is_correct | BOOLEAN | Server-determined correctness |
| answers | submitted_at | TIMESTAMPTZ | When the answer was submitted |
| penalties | id | SERIAL | Unique identifier for each penalty |
| penalties | player_id | INT | Reference to the penalized player |
| penalties | session_id | INT | Reference to the session |
| penalties | reason | VARCHAR(255) | Why the penalty was given |
| penalties | created_at | TIMESTAMPTZ | When the penalty was applied |
| leaderboards | id | SERIAL | Unique identifier for each leaderboard |
| leaderboards | session_id | INT | Reference to the session (unique) |
| leaderboards | rankings | JSONB | JSON array of player rankings |
| leaderboards | updated_at | TIMESTAMPTZ | When the leaderboard was last updated |
