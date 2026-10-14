-- Phone numbers are no longer asked for at signup. Rebuild players so phone is
-- optional and not unique (SQLite can't alter constraints in place). Existing
-- numbers are kept.
CREATE TABLE players_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  team_id INTEGER REFERENCES teams (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO players_new (id, name, phone, team_id, created_at)
SELECT id, name, phone, team_id, created_at FROM players;

DROP TABLE players;

ALTER TABLE players_new RENAME TO players;

CREATE INDEX players_team ON players (team_id);
