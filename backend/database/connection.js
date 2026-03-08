const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "DNDTool"
};

if (!dbConfig.password) {
  console.warn('Warning: MYSQL_PASSWORD is not set. Create a backend/.env file or set MYSQL_PASSWORD in your environment.');
}

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

// Helper: check if a table exists in the current database
async function hasTable(db, tableName) {
  const [rows] = await db.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

// Helper: check if a column exists on a table in the current database
async function hasColumn(db, tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureSchema(db) {
  await run(
    db,
    "CREATE TABLE IF NOT EXISTS metadata (`key` VARCHAR(255) PRIMARY KEY, `value` TEXT);"
  );

  // Ensure users table has role column
  try {
    const usersTableExists = await hasTable(db, 'users');
    if (usersTableExists) {
      const hasRole = await hasColumn(db, 'users', 'role');
      if (!hasRole) {
        await run(db, "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';");
        console.log('Users alter result: added role column');
      } else {
        console.log('Users alter result: role column already exists');
      }
    } else {
      console.log('Users alter result: users table does not exist yet');
    }
  } catch (err) {
    console.log('Users alter result:', err.message);
  }

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
      campaign_id VARCHAR(36) DEFAULT NULL,
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
  // Check table and columns via INFORMATION_SCHEMA to be compatible with older MySQL versions
  try {
    const mapTokensExists = await hasTable(db, 'map_tokens');
    if (!mapTokensExists) {
      console.log('Map tokens alter result: map_tokens table does not exist yet');
    } else {
      // is_visible_to_players
      const hasVisibility = await hasColumn(db, 'map_tokens', 'is_visible_to_players');
      if (!hasVisibility) {
        await run(db, "ALTER TABLE map_tokens ADD COLUMN is_visible_to_players BOOLEAN DEFAULT TRUE;");
        console.log('Map tokens alter result: added is_visible_to_players');
      } else {
        console.log('Map tokens alter result: is_visible_to_players already exists');
      }

      // transparency
      const hasTransparency = await hasColumn(db, 'map_tokens', 'transparency');
      if (!hasTransparency) {
        await run(db, "ALTER TABLE map_tokens ADD COLUMN transparency FLOAT DEFAULT 1.0;");
        console.log('Map tokens alter result: added transparency');
      } else {
        console.log('Map tokens alter result: transparency already exists');
      }
    }
  } catch (err) {
    console.log('Map tokens alter result:', err.message);
  }

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
