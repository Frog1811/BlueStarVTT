const mysql = require("mysql2/promise");

async function checkAndAddColumns() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "BlueStar6321",
    database: "DNDTool"
  });

  try {
    console.log("Checking map_tokens table structure...");

    // Check if columns exist
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='map_tokens' AND TABLE_SCHEMA='DNDTool'`
    );

    const columnNames = columns.map(c => c.COLUMN_NAME);
    console.log("Current columns:", columnNames);

    // Add columns if they don't exist
    if (!columnNames.includes('is_visible_to_players')) {
      console.log("Adding is_visible_to_players column...");
      await connection.query(
        `ALTER TABLE map_tokens ADD COLUMN is_visible_to_players BOOLEAN DEFAULT TRUE`
      );
      console.log("✓ is_visible_to_players column added");
    } else {
      console.log("✓ is_visible_to_players column already exists");
    }

    if (!columnNames.includes('transparency')) {
      console.log("Adding transparency column...");
      await connection.query(
        `ALTER TABLE map_tokens ADD COLUMN transparency FLOAT DEFAULT 1.0`
      );
      console.log("✓ transparency column added");
    } else {
      console.log("✓ transparency column already exists");
    }

    console.log("\nDatabase columns setup complete!");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await connection.end();
  }
}

checkAndAddColumns();

