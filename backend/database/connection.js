const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "BlueStar6321",
  database: process.env.MYSQL_DATABASE || "DNDTool"
};

async function openDatabase() {
  return mysql.createPool({
    ...dbConfig,
    connectionLimit: 5
  });
}

async function run(db, sql, params = []) {
  return db.execute(sql, params);
}

async function get(db, sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows[0];
}

async function ensureSchema(db) {
  await run(
    db,
    "CREATE TABLE IF NOT EXISTS metadata (`key` VARCHAR(255) PRIMARY KEY, `value` TEXT);"
  );

  // Ensure users table has role column
  await run(
    db,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';"
  ).catch(err => {
    console.log('Users alter result:', err.message);
  });

  await run(
    db,
    "UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"
  ).catch(err => {
    console.log('Users role backfill result:', err.message);
  });

  // Create map_folders table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS map_folders (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(7) DEFAULT '#3b82f6',
      parent_folder_id VARCHAR(36) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_parent_folder_id (parent_folder_id)
    );`
  );

  // Create maps table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS maps (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      folder_id VARCHAR(36) DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      filepath VARCHAR(512) NOT NULL,
      width INT NOT NULL,
      height INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_folder_id (folder_id)
    );`
  );

  // Create campaign_state table for shared state (like active map)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS campaign_state (
      campaign_id VARCHAR(36) PRIMARY KEY,
      active_map_id VARCHAR(36) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active_map (active_map_id)
    );`
  );

  // Create token_folders table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS token_folders (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_folder_id VARCHAR(36) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_parent_folder_id (parent_folder_id)
    );`
  );

  // Create tokens table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS tokens (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      token_folder_id VARCHAR(36) DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      image_path VARCHAR(512) NOT NULL,
      is_base_token BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_token_folder_id (token_folder_id)
    );`
  );

  // Ensure map_tokens table has visibility and transparency columns
  // This will only add columns if they don't already exist
  await run(
    db,
    `ALTER TABLE map_tokens 
     ADD COLUMN IF NOT EXISTS is_visible_to_players BOOLEAN DEFAULT TRUE,
     ADD COLUMN IF NOT EXISTS transparency FLOAT DEFAULT 1.0;`
  ).catch(err => {
    // Table might not exist yet (will be created by migrations), so ignore errors
    console.log('Map tokens alter result:', err.message);
  });

  // Create initiative_tracker table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS initiative_tracker (
      id VARCHAR(36) PRIMARY KEY,
      map_id VARCHAR(36) NOT NULL,
      map_token_id VARCHAR(36) NOT NULL,
      initiative_value INT NOT NULL CHECK(initiative_value >= 1 AND initiative_value <= 40),
      sort_order INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_initiative_tracker_map_id (map_id),
      INDEX idx_initiative_tracker_sort (map_id, initiative_value DESC, sort_order),
      FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY (map_token_id) REFERENCES map_tokens(id) ON DELETE CASCADE
    );`
  );

  // Create token_groups table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS token_groups (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token_groups_campaign_id (campaign_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );`
  );

  // Create token_group_members table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS token_group_members (
      id VARCHAR(36) PRIMARY KEY,
      group_id VARCHAR(36) NOT NULL,
      map_token_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_group_member (group_id, map_token_id),
      INDEX idx_token_group_members_group_id (group_id),
      INDEX idx_token_group_members_map_token_id (map_token_id),
      FOREIGN KEY (group_id) REFERENCES token_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (map_token_id) REFERENCES map_tokens(id) ON DELETE CASCADE
    );`
  );

  // Create bug_reports table
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS bug_reports (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      username VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bug_reports_user_id (user_id),
      INDEX idx_bug_reports_created_at (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`
  );
}

module.exports = {
  dbConfig,
  openDatabase,
  run,
  get,
  ensureSchema
};
