const mysql = require("mysql2/promise");

async function fixTokenDefaults() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "BlueStar6321",
    database: "DNDTool"
  });

  try {
    console.log("Setting default values for tokens without visibility settings...");

    // Update NULL values to defaults
    await connection.query(
      `UPDATE map_tokens 
       SET is_visible_to_players = COALESCE(is_visible_to_players, TRUE),
           transparency = COALESCE(transparency, 1.0)`
    );

    console.log("✓ Token defaults updated");

    // Check a few tokens to verify
    const [tokens] = await connection.query(
      `SELECT id, is_visible_to_players, transparency FROM map_tokens LIMIT 3`
    );

    console.log("\nSample tokens:");
    tokens.forEach(t => {
      console.log(`  ID: ${t.id}, visible: ${t.is_visible_to_players}, transparency: ${t.transparency}`);
    });

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await connection.end();
  }
}

fixTokenDefaults();

