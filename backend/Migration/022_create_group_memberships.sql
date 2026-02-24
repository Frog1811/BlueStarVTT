-- Create token_group_members junction table to link tokens to groups
CREATE TABLE IF NOT EXISTS token_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  map_token_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES token_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (map_token_id) REFERENCES map_tokens(id) ON DELETE CASCADE,
  UNIQUE (group_id, map_token_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_group_members_group_id ON token_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_token_group_members_map_token_id ON token_group_members(map_token_id);

