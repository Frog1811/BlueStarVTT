-- Add player_name column for DM-created player trackers
ALTER TABLE player_stats ADD COLUMN player_name VARCHAR(255) NULL AFTER user_id;

