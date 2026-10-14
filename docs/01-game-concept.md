# Game Concept Document — Bomb Pass

## 1. Title and One-Line Pitch

**Bomb Pass** — Answer questions and pass the bomb. When time runs out, the holder gets a penalty. Last player standing wins.

## 2. Genre and Platform

- **Genre:** Multiplayer Question-Based Action Game
- **Platform:** Web Browser
- **Architecture:** Client-Server (Layered/MVC)

## 3. Target Players

- **Primary:** Library visitors, high school students, college students
- **Secondary:** Casual players who enjoy simple multiplayer games
- **Players per session:** 3-30

## 4. Core Loop

**Join → Answer → Pass → Explode → Penalize → Win** (6 verbs, Hub Contract v1)

1. **Join** — Player enters 6-digit code and nickname (no account)
2. **Answer** — Player submits an answer choice to the active question
3. **Pass** — Current bomb holder passes the bomb to another active player
4. **Explode** — Bomb deadline passes; the bomb expires
5. **Penalize** — Bomb holder receives 1 penalty; eliminated at 3 penalties
6. **Win** — Last active player remaining wins the game

Session statuses: `waiting` → `playing` → `ended`.

## 5. Mechanics and Controls

### Host Mechanics
- Log in with credentials
- Select a question set
- Start a game session (server generates 6-digit join code)
- View game results

### Player Mechanics
- Join session using 6-digit code and nickname (no account needed)
- View questions with answer choices
- Submit one answer per question
- Pass the bomb to another active player
- View penalty count and active/eliminated status
- View final leaderboard

### Controls
| Control | Action |
|---------|--------|
| Select Answer | Click/tap an answer choice |
| Pass Bomb | Select target player and confirm |
| Confirm | Submit selected answer/action |
| Join Game | Enter 6-digit code and nickname |

## 6. Win/Lose Rules

### Winning
- The game ends when only one active player remains
- That player is the winner

### Losing
- A player is eliminated after receiving 3 penalties
- A penalty is received when the bomb timer expires while holding the bomb

### Tie-Breaking
- [DESIGN DECISION] — Not applicable; game continues until one player remains

## 7. Features (MoSCoW)

### Must-Have (M)
| ID | Feature |
|----|---------|
| M1 | Host can start a game session |
| M2 | Players can join using a 6-digit code |
| M3 | Players can join using a nickname |
| M4 | Host can select a question set |
| M5 | Players can answer questions |
| M6 | Players can pass the virtual bomb |
| M7 | Countdown timer is supported |
| M8 | System determines who holds the bomb when timer expires |
| M9 | Penalty/elimination is recorded |
| M10 | Leaderboard shows player rankings |

### Should-Have (S)
| ID | Feature |
|----|---------|
| S1 | Display remaining time |
| S2 | Display current bomb holder |
| S3 | Display player status |
| S4 | Show penalty count |
| S5 | Show game results after the session |

### Could-Have (C)
| ID | Feature |
|----|---------|
| C1 | Sound effect when bomb is passed |
| C2 | Warning sound when timer is nearly finished |
| C3 | Different bomb designs |
| C4 | Different game rounds |
| C5 | Explosion animation |

### Won't-Have (W)
| ID | Feature |
|----|---------|
| W1 | Player accounts for joining a game |
| W2 | Real-money rewards |
| W3 | Physical bomb or real-world equipment |
| W4 | Personal data from players — no real name, student ID, email, phone, or photo is collected; only hosts have accounts (Hub Contract v1, Rule 5) |

## 8. Backend Features and Hub Contract Fit

### Backend Features
- REST API with `/api/v1` prefix
- Bearer token authentication for host operations
- 6-digit session join codes (server-generated)
- Question set management
- Session lifecycle management
- Server-side answer validation (correct answers never exposed)
- Bomb state management (holder, timer, passing)
- Penalty/elimination tracking
- Leaderboard calculation
- Health check and game info endpoints

### Hub Contract Fit
| Hub Contract Rule | Bomb Pass Implementation |
|--------------------------|---------------------------|
| Rule 1: `GET /api/v1/game-info` | Returns all 9 fields (slug, name, team, description, min/max players, thumbnail_url, play_url, version); validated on startup |
| Rule 2: `GET /api/v1/health` | 200 `{status:"ok",database:"ok",time}` only when a real `SELECT 1` succeeds; 503 DATABASE_DOWN otherwise |
| Rule 3: question-set format | `{title, description, subject, grade_level, questions:[{text, type, choices[], correct_index, time_limit_sec}]}`; validated in QuestionFactory; correct_index never sent to players |
| Rule 4: one error format | `{error:{code,message}}` from a single middleware; all codes in one constants file |
| Rule 5: sessions, codes, privacy | 6-digit codes never starting with 0, unique among open sessions; nickname 2-20 chars, bad-word filtered; player token 3h, one session; no personal data collected |
| Rule 6: URLs and naming | `/api/v1` prefix, plural lowercase nouns, hyphens; fixed names auth, question-sets, sessions, players, answers, leaderboard; game-specific bomb-passes, questions |
| §2/§7: deployment | FINAL: one library server (`node server.js`, env PORT default 3001) behind the hub forwarding `/games/bomb-pass/`; PostgreSQL schema `bomb_pass`. TEST: Vercel serverless + Neon Postgres (`/api/index.js`). Same router mounted at `/api/v1` and `/games/bomb-pass/api/v1` |
| Stateless design | No in-memory game state, no timers, no WebSockets; lazy expiration driven by client polling (GET /sessions/{code} every 1-2s) |
| 6-digit join codes | Generated server-side, never start with 0, unique among open sessions |
| No correct answer exposure | Server validates answers; only correctness boolean returned; correct_index only on host endpoints |

### Design Patterns
- **Repository Pattern:** All database operations isolated in repository classes
- **Singleton Pattern:** Single database connection pool for the entire API
- **Factory Pattern:** Centralized creation of question objects from JSON input

### Architecture
Client → Routes → Controllers → Services → Repositories → Database
