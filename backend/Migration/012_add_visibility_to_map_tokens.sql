ALTER TABLE map_tokens
ADD COLUMN is_visible_to_players BOOLEAN DEFAULT TRUE,
ADD COLUMN transparency FLOAT DEFAULT 1.0;

