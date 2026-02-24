-- Map Notes table for storing markdown notes bound to maps and campaigns
CREATE TABLE IF NOT EXISTS map_notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  map_id CHAR(36) NOT NULL,
  content LONGTEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_map_notes (campaign_id, map_id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_map_id (map_id),
  CONSTRAINT fk_map_notes_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_map_notes_map
    FOREIGN KEY (map_id) REFERENCES maps(id)
    ON DELETE CASCADE
);

