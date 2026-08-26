-- Lenny Garden persistent schema (foundation for growth + friends).
-- No secrets here. Wire via env-provided DB credentials (Turso/Supabase).

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  bloom_level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gardens (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
  data TEXT,
  lights INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zone_progress (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  zone_id TEXT NOT NULL,
  finished INTEGER NOT NULL DEFAULT 0,
  unlocked INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, zone_id)
);

CREATE TABLE IF NOT EXISTS friends (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  friend_id TEXT NOT NULL REFERENCES profiles(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, friend_id)
);

CREATE TABLE IF NOT EXISTS visits (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  visited_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_profile ON visits(profile_id);
