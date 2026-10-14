# Pitching Cheat Sheet — Bomb Pass

### 1. What is Bomb Pass?
A multiplayer web-based question game where players answer questions while passing a virtual bomb. When time runs out, the holder gets a penalty. Last player standing wins.

### 2. What problem/game experience does it provide?
It combines quiz mechanics with real-time player interaction. The bomb creates time pressure and forces players to strategize about who to pass to.

### 3. How does a player join?
Enter the 6-digit session code and choose a nickname (2-20 characters, bad-word filtered). No account needed — and no personal data is collected (no real name, student ID, email, phone, or photo).

### 4. How does the bomb work?
The server tracks who holds the bomb. The current holder can pass it to another active player. A countdown deadline is stored in the database (`bomb_expires_at`); passing resets it.

### 5. What happens when the timer expires?
The current bomb holder receives 1 penalty. After 3 penalties, the player is eliminated. Expiration is lazy: it is processed on the next request that reads or changes the session (clients poll every 1-2 s), so there are no background timers.

### 6. How does a player win?
The game ends when only one active player remains. That player is the winner. Session statuses: waiting → playing → ended.

### 7. Why is the server authoritative?
To prevent cheating. The server validates answers, tracks the bomb holder, manages the deadline, and determines penalties. The client only displays state.

### 8. How are correct answers protected?
The server stores the correct choice index but never sends it to players. The player submits a choice, and the server returns only `{correct, score, rank}`. Only the owning host's question-set endpoints may return `correct_index`, so a set can be exported/imported.

### 9. What is the API structure?
REST API under `/api/v1` (also mounted at `/games/bomb-pass/api/v1`), plural lowercase nouns with hyphens. 21 endpoints: health, game-info, auth/login, question-sets (POST/GET/GET by id/export/import/copy), sessions (POST/GET/GET by code/PATCH/results), players (POST/GET/DELETE), questions/current, answers, bomb-passes, leaderboard. Every error uses one format: `{error:{code,message}}` with UPPER_SNAKE_CASE codes (e.g. 404 SESSION_NOT_FOUND, "No game uses the join code 999999.").

### 10. What is the architecture?
Layered architecture: Client → Routes → Controllers → Services → Repositories → Database. Uses Repository, Singleton (one module-level pg Pool), Factory (QuestionFactory), and MVC patterns. All SQL lives in repositories; all rules live in services.

### 11. How does Bomb Pass fit the Library Game Hub?
It follows Hub Contract v1 exactly: game-info with all 9 fields, health with a real DB check, one question-set format (Rule 3), one error format (Rule 4), 6-digit join codes that never start with 0, nickname-only players, and clean plural-noun URLs (Rule 6).

### 12. What are the major database entities?
PostgreSQL schema `bomb_pass`: hosts, login_attempts, question_sets, questions, choices, sessions, players, answers, penalties, leaderboards.

### 13. What happens if two players try to pass the bomb simultaneously?
The pass is atomic via a session row lock (`SELECT ... FOR UPDATE`). The requests serialize; the second caller re-reads the holder, sees it is no longer them, and gets 403 NOT_BOMB_HOLDER.

### 14. What happens if an eliminated player is targeted?
The server validates the target's active status before accepting the pass. Eliminated players cannot receive the bomb. Returns 400 TARGET_ELIMINATED.

### 15. What happens if the session code does not exist?
The server returns 404 SESSION_NOT_FOUND: "No game uses the join code 999999."

### 16. How does the timer work without background jobs?
It doesn't need them. The bomb deadline is a timestamp in the database. Every session request first runs `SessionStateService.reconcile(code)` in a transaction: while the deadline has passed, it applies penalties, eliminates at 3, checks for a winner, and reassigns the bomb with the next deadline = previous deadline + timer (catch-up). Clients poll `GET /sessions/{code}` every 1-2 s, which drives reconciliation. Stateless and serverless-safe.

### 17. Where does it run?
FINAL: one library server — `node server.js` on the instructor-assigned port (env PORT, default 3001), behind the hub forwarding `/games/bomb-pass/`, with PostgreSQL schema `bomb_pass`. TEST: Vercel serverless function (`/api/index.js`) + Neon Postgres — same code, two thin entry points.
