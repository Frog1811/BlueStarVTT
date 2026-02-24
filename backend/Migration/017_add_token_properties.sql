-- Add token instance name and border color to map_tokens
ALTER TABLE map_tokens ADD COLUMN token_instance_name VARCHAR(255) NULL AFTER size;
ALTER TABLE map_tokens ADD COLUMN border_color VARCHAR(50) NULL DEFAULT NULL AFTER token_instance_name;

