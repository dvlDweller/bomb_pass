# Sequence + Activity Diagrams — Bomb Pass

## Sequence Diagram 1: Host Login

```
Host          API              AuthService       AuthRepo         Database
 │             │                    │               │               │
 │──POST /auth/login───────────────>│               │               │
 │  {username, password}            │               │               │
 │             │                    │──validate()──>│               │
 │             │                    │               │──SELECT──────>│
 │             │                    │               │<─host record──│
 │             │                    │<─host data────│               │
 │             │<─200 {token}───────│               │               │
 │<─200 {token}│                    │               │               │
```

## Sequence Diagram 2: Player Join

```
Player        API              PlayerService     PlayerRepo       Database
 │             │                    │               │               │
 │──POST /sessions/{code}/players──>│               │               │
 │  {nickname}                      │               │               │
 │             │                    │──validate()──>│               │
 │             │                    │               │──SELECT──────>│
 │             │                    │               │<─session──────│
 │             │                    │──checkUnique()>│               │
 │             │                    │               │──SELECT──────>│
 │             │                    │               │<─players──────│
 │             │                    │──create()────>│               │
 │             │                    │               │──INSERT──────>│
 │             │                    │<─player───────│               │
 │             │<─201 {player}──────│               │               │
 │<─201 {player}│                   │               │               │
```

## Sequence Diagram 3: Submit Answer

```
Player        API              AnswerService      AnswerRepo       Database
 │             │                    │               │               │
 │──POST /sessions/{code}/answers──>│               │               │
 │  {question_id, choice_index}     │               │               │
 │             │                    │──validate()──>│               │
 │             │                    │               │──SELECT──────>│
 │             │                    │               │<─question─────│
 │             │                    │──checkCorrect()>               │
 │             │                    │──save()──────>│               │
 │             │                    │               │──INSERT──────>│
 │             │                    │<─result───────│               │
 │             │<─201 {correct}─────│               │               │
 │<─201 {correct}│                  │               │               │
```

## Sequence Diagram 4: Pass Bomb (atomic, row-locked, reconcile-first)

```
Player        API              BombService       SessionStateSvc   Database
 │             │                    │                   │             │
 │──POST /sessions/{code}/bomb-passes>                │             │
 │  {target_player_id}              │                   │             │
 │             │                    │──BEGIN──────────>│             │
 │             │                    │                   │──SELECT session FOR UPDATE──>│
 │             │                    │                   │<─session row (locked)────────│
 │             │                    │──reconcile()────>│             │
 │             │                    │                   │ (no expired deadline: no-op) │
 │             │                    │──checkHolder: bomb_holder_id == player.id?      │
 │             │                    │──checkTarget: target exists & active?           │
 │             │                    │──update()────────│────────────>│
 │             │                    │  SET bomb_holder_id = target,                   │
 │             │                    │  bomb_expires_at = now + BOMB_TIMER_SECONDS     │
 │             │                    │<─COMMIT──────────│             │
 │             │<─200 {new_holder_id, new_holder_nickname, timer_reset, bomb_expires_at}│
 │<─200 {...}──│                    │                   │             │
```

Race note: if two passes run at once, the row lock serializes them. The
second caller re-reads `bomb_holder_id` after the first commits, sees it is
no longer the requester, and gets 403 NOT_BOMB_HOLDER.

## Sequence Diagram 5: Lazy Reconcile (no background timer)

```
Client        API              SessionStateService  QuestionFlowSvc  Database
 │             │                    │                   │             │
 │──GET /sessions/{code}──────────>│                   │             │
 │  (poll every 1-2s)              │                   │             │
 │             │                    │──BEGIN──────────>│             │
 │             │                    │                   │──SELECT session FOR UPDATE──>│
 │             │                    │                   │<─session row (locked)────────│
 │             │                    │                   │             │
 │             │                    │  loop while bomb_expires_at <= now:             │
 │             │                    │──insert penalty for holder──────>│
 │             │                    │──increment penalty_count────────>│
 │             │                    │──eliminate at 3 penalties───────>│
 │             │                    │──win check: 1 active left?       │
 │             │                    │   yes → status ended, winner, ended_at,        │
 │             │                    │         write final leaderboard  │
 │             │                    │   no  → random active holder,    │
 │             │                    │         deadline = PREVIOUS + timer             │
 │             │                    │                   │             │
 │             │                    │  then: question_expires_at <= now OR all active │
 │             │                    │  answered? → advance to next question (wrap),   │
 │             │                    │  question_expires_at = now + time_limit_sec     │
 │             │                    │<─COMMIT──────────│             │
 │             │<─200 {status, bomb_holder_nickname, bomb_expires_at, question_expires_at, server_time}│
 │<─200 {...}──│                    │                   │             │
```

There is NO background timer: expiration happens lazily on the next request
that reads or changes the session (clients poll every 1-2 s).

## Sequence Diagram 6: Start Game (PATCH)

```
Host          API              SessionService      QuestionFlowSvc   Database
 │             │                    │                   │             │
 │──PATCH /sessions/{code}────────>│                   │             │
 │  {status:"playing"}              │                   │             │
 │             │                    │──reconcile()────>│             │
 │             │                    │──check: status waiting? host owns it?         │
 │             │                    │──count active players >= 2? → else 409 NOT_ENOUGH_PLAYERS│
 │             │                    │──firstQuestion()─>│             │
 │             │                    │                   │──SELECT first question──────>│
 │             │                    │                   │<─question (time_limit_sec)────│
 │             │                    │──UPDATE sessions: status playing, started_at,   │
 │             │                    │  random first bomb holder, bomb_expires_at,     │
 │             │                    │  current_question_id, question_expires_at       │
 │             │                    │<─200 {status:"playing", bomb_holder_nickname,   │
 │             │                    │  bomb_expires_at, question_expires_at}          │
 │<─200 {...}──│                    │                   │             │
```

## Activity Diagram: Complete Game Flow

```
┌─────────────┐
│   START     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Host Login  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No    ┌─────────────┐
│ Login OK?   │──────────>│ Show Error  │
└──────┬──────┘           └─────────────┘
       │ Yes
       ▼
┌─────────────┐
│ Select      │
│ Question Set│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Start       │
│ Session     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Generate    │
│ 6-digit Code│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Players     │
│ Join        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Game Loop   │◄──────────────────────────────┐
│ Starts      │                               │
└──────┬──────┘                               │
        │                                      │
        ▼                                      │
┌─────────────┐                               │
│ Send        │                               │
│ Question    │                               │
└──────┬──────┘                               │
        │                                      │
        ▼                                      │
┌─────────────┐                               │
│ Players     │                               │
│ Answer      │                               │
└──────┬──────┘                               │
        │                                      │
        ▼                                      │
┌─────────────┐                               │
│ Bomb Holder │                               │
│ Passes Bomb │                               │
└──────┬──────┘                               │
        │                                      │
        ▼                                      │
┌─────────────┐                               │
│ Client polls│                               │
│ GET session │                               │
│ every 1-2s  │                               │
└──────┬──────┘                               │
        │                                      │
        ▼                                      │
┌─────────────┐     No    ┌─────────────┐     │
│ Bomb        │──────────>│ Continue    │─────┘
│ Exploded?   │           │ Game Loop   │
│ (reconcile) │           │             │
└──────┬──────┘           └─────────────┘
        │ Yes
        ▼
┌─────────────┐
│ Bomb Holder │
│ Receives    │
│ Penalty     │
└──────┬──────┘
        │
        ▼
┌─────────────┐     No    ┌─────────────┐
│ Player      │──────────>│ Continue    │──────┐
│ Eliminated? │           │ Game Loop   │      │
└──────┬──────┘           └─────────────┘      │
        │ Yes                                  │
        ▼                                      │
┌─────────────┐                               │
│ Only 1      │     No    ┌─────────────┐     │
│ Player      │──────────>│ Continue    │─────┘
│ Left?       │           │ Game Loop   │
└──────┬──────┘           └─────────────┘
        │ Yes
        ▼
┌─────────────┐
│ Show        │
│ Leaderboard │
└──────┬──────┘
        │
        ▼
┌─────────────┐
│    END      │
└─────────────┘
```
