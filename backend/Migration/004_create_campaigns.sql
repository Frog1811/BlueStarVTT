CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  DungeonMaster CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaigns_dungeonmaster (DungeonMaster),
  CONSTRAINT fk_campaigns_users
    FOREIGN KEY (DungeonMaster) REFERENCES users(id)
    ON DELETE CASCADE
);

