-- Query to check all maps in the database
SELECT
  m.id,
  m.name,
  m.filename,
  m.filepath,
  m.campaign_id,
  m.folder_id,
  m.width,
  m.height,
  m.created_at,
  c.name as campaign_name
FROM maps m
LEFT JOIN campaigns c ON m.campaign_id = c.id
ORDER BY m.created_at DESC;

-- Count maps per campaign
SELECT
  c.id,
  c.name as campaign_name,
  COUNT(m.id) as map_count
FROM campaigns c
LEFT JOIN maps m ON c.id = m.campaign_id
GROUP BY c.id, c.name;

