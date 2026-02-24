CREATE TABLE IF NOT EXISTS tokens (
  id VARCHAR(36) PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  token_folder_id VARCHAR(36) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  image_path VARCHAR(512) NOT NULL,
  is_base_token BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (token_folder_id) REFERENCES token_folders(id) ON DELETE CASCADE,
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_token_folder_id (token_folder_id)
);

