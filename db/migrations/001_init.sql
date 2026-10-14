-- Bomb Pass initial schema (PostgreSQL / Neon) - Hub Contract v1
CREATE SCHEMA IF NOT EXISTS bomb_pass;
SET search_path TO bomb_pass, public;

CREATE TABLE IF NOT EXISTS hosts (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Database-backed login rate limiting (no in-memory state, serverless-safe).
-- ip_hash is a SHA-256 of the IP, never the IP itself.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50) NOT NULL,
  ip_hash      VARCHAR(64),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts (username, attempted_at);

CREATE TABLE IF NOT EXISTS question_sets (
  id           SERIAL PRIMARY KEY,
  host_id      INT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  title        VARCHAR(80) NOT NULL,
  description  VARCHAR(500),
  subject      VARCHAR(100),
  grade_level  VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_sets_host ON question_sets (host_id);

CREATE TABLE IF NOT EXISTS questions (
  id              SERIAL PRIMARY KEY,
  question_set_id INT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  position        INT NOT NULL DEFAULT 0,
  text            TEXT NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'multiple_choice'
                  CHECK (type IN ('multiple_choice', 'true_false')),
  correct_index   INT NOT NULL,
  time_limit_sec  INT NOT NULL DEFAULT 20 CHECK (time_limit_sec BETWEEN 5 AND 60),
  points          INT NOT NULL DEFAULT 100
);
CREATE INDEX IF NOT EXISTS idx_questions_set ON questions (question_set_id);

CREATE TABLE IF NOT EXISTS choices (
  id           SERIAL PRIMARY KEY,
  question_id  INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_index INT NOT NULL,
  choice_text  VARCHAR(120) NOT NULL,
  UNIQUE (question_id, choice_index)
);
CREATE INDEX IF NOT EXISTS idx_choices_question ON choices (question_id);

-- sessions references players (bomb_holder_id, winner_player_id) and questions
-- (current_question_id); those FKs are added after the players table exists.
CREATE TABLE IF NOT EXISTS sessions (
  id                  SERIAL PRIMARY KEY,
  host_id             INT NOT NULL REFERENCES hosts(id),
  question_set_id     INT NOT NULL REFERENCES question_sets(id),
  join_code           CHAR(6) NOT NULL CHECK (join_code ~ '^[1-9][0-9]{5}$'),
  status              VARCHAR(20) NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting', 'playing', 'ended')),
  bomb_holder_id      INT,
  bomb_expires_at     TIMESTAMPTZ,
  current_question_id INT,
  question_expires_at TIMESTAMPTZ,
  winner_player_id    INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ
);
-- Join codes are unique among OPEN sessions only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_open_join_code
  ON sessions (join_code) WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS idx_sessions_host ON sessions (host_id);
CREATE INDEX IF NOT EXISTS idx_sessions_question_set ON sessions (question_set_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  session_id    INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname      VARCHAR(20) NOT NULL,
  score         INT NOT NULL DEFAULT 0,
  penalty_count INT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated')),
  eliminated_at TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, nickname)
);
CREATE INDEX IF NOT EXISTS idx_players_session ON players (session_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_bomb_holder_fk') THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_bomb_holder_fk
      FOREIGN KEY (bomb_holder_id) REFERENCES players(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_winner_fk') THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_winner_fk
      FOREIGN KEY (winner_player_id) REFERENCES players(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_current_question_fk') THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_current_question_fk
      FOREIGN KEY (current_question_id) REFERENCES questions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS answers (
  id           SERIAL PRIMARY KEY,
  session_id   INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id    INT NOT NULL REFERENCES players(id),
  question_id  INT NOT NULL REFERENCES questions(id),
  choice_index INT NOT NULL,
  is_correct   BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers (session_id);
CREATE INDEX IF NOT EXISTS idx_answers_player ON answers (player_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers (question_id);

CREATE TABLE IF NOT EXISTS penalties (
  id         SERIAL PRIMARY KEY,
  player_id  INT NOT NULL REFERENCES players(id),
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reason     VARCHAR(255) NOT NULL DEFAULT 'bomb_expiration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_penalties_player ON penalties (player_id);
CREATE INDEX IF NOT EXISTS idx_penalties_session ON penalties (session_id);

CREATE TABLE IF NOT EXISTS leaderboards (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  rankings   JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leaderboards_session ON leaderboards (session_id);
