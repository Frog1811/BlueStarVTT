-- Run this in phpMyAdmin to verify your campaign exists
-- and check if the DungeonMaster ID matches your user ID

-- Your User ID from the logs:
-- 2579b56e-5420-41f9-bc6a-1ad2a4acf7a9

-- Your Campaign ID from the URL:
-- 6ce3fee9-372c-4766-abd8-09d7a7e2c910

-- Check if the campaign exists:
SELECT
    id as campaign_id,
    name as campaign_name,
    DungeonMaster as dm_user_id,
    created_at
FROM campaigns
WHERE id = '6ce3fee9-372c-4766-abd8-09d7a7e2c910';

-- Check if your user exists:
SELECT
    id as user_id,
    username,
    email
FROM users
WHERE id = '2579b56e-5420-41f9-bc6a-1ad2a4acf7a9';

-- List all campaigns owned by your user:
SELECT
    id as campaign_id,
    name as campaign_name,
    created_at
FROM campaigns
WHERE DungeonMaster = '2579b56e-5420-41f9-bc6a-1ad2a4acf7a9'
ORDER BY created_at DESC;

