# User Story Backlog with MoSCoW — Bomb Pass

## Host User Stories

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-H01 | As a host, I want to log in so that I can access host-only operations. | MUST | Login returns Bearer token (JWT, TTL env HOST_TOKEN_TTL default 8h); invalid credentials return 401 INVALID_CREDENTIALS; rate-limited via login_attempts |
| US-H02 | As a host, I want to create a question set so that I can use it for my game session. | MUST | Question set created in the Hub Contract v1 Rule 3 format; correct_index stored securely, never sent to players |
| US-H03 | As a host, I want to start a game session so that players can join and play. | MUST | Session created with unique 6-digit join code that never starts with 0 |
| US-H04 | As a host, I want the server to generate a 6-digit join code so that players can join my session. | MUST | Code is exactly 6 digits, never starts with 0, unique among open sessions |
| US-H05 | As a host, I want to select a question set for my session so that players answer relevant questions. | MUST | Session linked to selected question set; another host's set → 403 NOT_YOUR_QUESTION_SET |
| US-H06 | As a host, I want to view the game results after the session so that I can see the final rankings. | SHOULD | Final leaderboard displayed with all players and their status; results stay saved for later review |
| US-H07 | As a host, I want to list and view my question sets so that I can reuse them. | SHOULD | GET /question-sets returns only the calling host's sets; GET /question-sets/{id} returns the full Rule 3 set including correct_index |
| US-H08 | As a host, I want to export and import my question sets as JSON so that I can back them up or share them. | SHOULD | GET /question-sets/{id} returns the exact Rule 3 shape (with correct_index); POST /question-sets accepts that same shape |
| US-H09 | As a host, I want to end a running session so that I can stop the game early. | MUST | PATCH /sessions/{code} with status "ended" sets ended, writes the final leaderboard; creating host only (403 NOT_YOUR_SESSION otherwise) |

## Player User Stories

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-P01 | As a player, I want to join a game using a 6-digit code and nickname so that I can play without creating an account. | MUST | Join succeeds with valid code + unique nickname (2-20 chars, bad-word filtered); no account required; player token valid 3 hours for this session only |
| US-P02 | As a player, I want to receive questions from the selected question set so that I can answer them. | MUST | GET /sessions/{code}/questions/current delivers the question without correct_index |
| US-P03 | As a player, I want to submit my answer choice so that the server can validate it. | MUST | Answer accepted; `{correct, score, rank}` returned; correct answer never exposed |
| US-P04 | As a player, I want to pass the bomb to another active player so that I don't get penalized when the timer expires. | MUST | Only current holder can pass (403 NOT_BOMB_HOLDER); target must be active (400 TARGET_ELIMINATED); no self-pass (400 CANNOT_PASS_TO_SELF); server validates |
| US-P05 | As a player, I want to see the countdown timer so that I know how much time is left. | SHOULD | Timer displayed and updated in real-time |
| US-P06 | As a player, I want to see who currently holds the bomb so that I know the current game state. | SHOULD | Current bomb holder visible to all players |
| US-P07 | As a player, I want to see my penalty count so that I know how close I am to elimination. | SHOULD | Penalty count displayed |
| US-P08 | As a player, I want to see my active/eliminated status so that I know if I'm still in the game. | SHOULD | Status clearly indicated |
| US-P09 | As a player, I want to see the final leaderboard after the game ends so that I can see my ranking. | SHOULD | Final rankings displayed with winner |
| US-P10 | As a player, I want to hear a sound effect when the bomb is passed so that the game feels more engaging. | COULD | Sound plays on successful pass |
| US-P11 | As a player, I want to hear a warning sound when the timer is almost done so that I know to pass the bomb quickly. | COULD | Warning sound plays in final seconds |
| US-P12 | As a player, I want to see different bomb designs so that the game is visually interesting. | COULD | Multiple bomb visual themes |
| US-P13 | As a player, I want to see an explosion animation when the bomb explodes so that the game feels exciting. | COULD | Animation plays on bomb expiration |

## Won't-Have User Stories

| ID | Story | Priority | Rationale |
|----|-------|----------|-----------|
| US-W01 | As a player, I do NOT need to create an account to join a game. | WON'T | Hub Contract v1, Rule 5: nickname + code only |
| US-W02 | As a player, I do NOT receive real-money rewards. | WON'T | Not applicable for library game |
| US-W03 | As a player, I do NOT need any physical equipment to play. | WON'T | Web browser only |
| US-W04 | As a player, I am NOT asked for my real name, student ID, email, phone, or photo. | WON'T | Hub Contract v1, Rule 5 privacy: only hosts have accounts; player IPs and user agents are not logged |

## MoSCoW Coverage Matrix

| MoSCoW | Feature | User Story | Covered? |
|--------|---------|------------|----------|
| MUST | Host can start a game session | US-H03 | Yes |
| MUST | Players can join using a 6-digit code | US-P01 | Yes |
| MUST | Players can join using a nickname | US-P01 | Yes |
| MUST | Host can select a question set | US-H05 | Yes |
| MUST | Players can answer questions | US-P02, US-P03 | Yes |
| MUST | Players can pass the virtual bomb | US-P04 | Yes |
| MUST | Countdown timer is supported | US-P05 | Yes |
| MUST | System determines bomb holder at expiration | US-P06 | Yes |
| MUST | Penalty/elimination is recorded | US-P07, US-P08 | Yes |
| MUST | Leaderboard shows player rankings | US-P09 | Yes |
| MUST | Host can end a session | US-H09 | Yes |
| SHOULD | Display remaining time | US-P05 | Yes |
| SHOULD | Display current bomb holder | US-P06 | Yes |
| SHOULD | Display player status | US-P08 | Yes |
| SHOULD | Show penalty count | US-P07 | Yes |
| SHOULD | Show game results after session | US-H06, US-P09 | Yes |
| SHOULD | List and view my question sets | US-H07 | Yes |
| SHOULD | Export/import question set JSON | US-H08 | Yes |
| COULD | Sound effect when bomb is passed | US-P10 | Yes |
| COULD | Warning sound when timer nearly finished | US-P11 | Yes |
| COULD | Different bomb designs | US-P12 | Yes |
| COULD | Explosion animation | US-P13 | Yes |
| WON'T | Player accounts | US-W01 | Yes |
| WON'T | Real-money rewards | US-W02 | Yes |
| WON'T | Physical equipment | US-W03 | Yes |
| WON'T | Personal data from players | US-W04 | Yes |
