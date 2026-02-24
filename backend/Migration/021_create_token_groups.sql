-- Create token_groups table for managing groups of tokens
CREATE TABLE IF NOT EXISTS token_groups (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Create index for faster lookups by campaign
CREATE INDEX IF NOT EXISTS idx_token_groups_campaign_id ON token_groups(campaign_id);

