CREATE TABLE IF NOT EXISTS map_tokens (
  id VARCHAR(36) PRIMARY KEY,
  map_id VARCHAR(36) NOT NULL,
  token_id VARCHAR(36) NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  size INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE,
  INDEX idx_map_id (map_id),
  INDEX idx_token_id (token_id)
);

