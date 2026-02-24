-- Populate base tokens from Icons folder
-- This makes base tokens work exactly like custom tokens

-- For each base token (Icons folder), create a record if it doesn't exist
-- Note: campaign_id is NULL for base tokens as they're global
-- is_base_token = 1 marks them as read-only base tokens

-- These will be created dynamically by the backend when it starts up
-- This file is just documentation of the approach

-- Example base tokens that will be auto-created:
-- INSERT INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token)
-- VALUES ('Aberration', NULL, NULL, 'Aberration', '/assets/Icons/Aberration.png', 1)
-- ON DUPLICATE KEY UPDATE name=name;

-- The backend will scan the Icons and JOCAT folders and create entries for all of them

