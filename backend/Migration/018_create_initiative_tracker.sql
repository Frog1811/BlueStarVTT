-- Migration: Create initiative_tracker table
-- Purpose: Track initiative order for combat encounters

CREATE TABLE IF NOT EXISTS initiative_tracker (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  map_token_id TEXT NOT NULL,
  initiative_value INTEGER NOT NULL CHECK(initiative_value >= 1 AND initiative_value <= 40),
  sort_order INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
  FOREIGN KEY (map_token_id) REFERENCES map_tokens(id) ON DELETE CASCADE
);

-- Index for faster queries by map_id
CREATE INDEX IF NOT EXISTS idx_initiative_tracker_map_id ON initiative_tracker(map_id);

-- Index for sorting by initiative value
CREATE INDEX IF NOT EXISTS idx_initiative_tracker_sort ON initiative_tracker(map_id, initiative_value DESC, sort_order);

