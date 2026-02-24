-- Player Stats table for tracking HP and AC per campaign
CREATE TABLE IF NOT EXISTS player_stats (
  id CHAR(36) NOT NULL PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  current_hp INT NOT NULL DEFAULT 0,
  max_hp INT NOT NULL DEFAULT 0,
  armor_class INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_player_campaign (campaign_id, user_id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_player_stats_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_player_stats_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

