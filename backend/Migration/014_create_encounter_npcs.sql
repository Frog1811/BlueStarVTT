-- NPC/Encounter Stats table for tracking enemies bound to maps
CREATE TABLE IF NOT EXISTS encounter_npcs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  map_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  current_hp INT NOT NULL DEFAULT 0,
  max_hp INT NOT NULL DEFAULT 0,
  armor_class INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_map_id (map_id),
  CONSTRAINT fk_encounter_npcs_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_encounter_npcs_map
    FOREIGN KEY (map_id) REFERENCES maps(id)
    ON DELETE CASCADE
);

