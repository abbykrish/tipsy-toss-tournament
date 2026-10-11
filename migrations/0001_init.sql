CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  seed INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX teams_name_unique ON teams (name COLLATE NOCASE);

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  -- Normalized digits; this is how entrants are deduped.
  phone TEXT NOT NULL UNIQUE,
  team_id INTEGER REFERENCES teams (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX players_team ON players (team_id);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage TEXT NOT NULL CHECK (stage IN ('prelim', 'bracket')),
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,
  team_a_id INTEGER REFERENCES teams (id),
  team_b_id INTEGER REFERENCES teams (id),
  seed_a INTEGER,
  seed_b INTEGER,
  score_a INTEGER,
  score_b INTEGER,
  winner_id INTEGER REFERENCES teams (id),
  is_bye INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 11,
  UNIQUE (stage, round, position)
);
