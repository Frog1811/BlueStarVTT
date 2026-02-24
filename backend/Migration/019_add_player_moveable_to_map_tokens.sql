-- Add player_moveable flag to map_tokens
ALTER TABLE map_tokens ADD COLUMN player_moveable TINYINT(1) DEFAULT 0 AFTER border_color;

