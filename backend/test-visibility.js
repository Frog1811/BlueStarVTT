const mysql = require("mysql2/promise");

async function testTokenVisibility() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "BlueStar6321",
    database: "DNDTool"
  });

  try {
    console.log("Checking token visibility data...\n");

    // Get a sample of tokens with visibility info
    const [tokens] = await connection.query(
      `SELECT id, is_visible_to_players, transparency FROM map_tokens LIMIT 5`
    );

    console.log("Sample tokens from database:");
    tokens.forEach((t, i) => {
      console.log(`  ${i+1}. ID: ${t.id.substring(0,8)}...`);
      console.log(`     is_visible_to_players: ${t.is_visible_to_players} (type: ${typeof t.is_visible_to_players})`);
      console.log(`     transparency: ${t.transparency} (type: ${typeof t.transparency})`);
      console.log();
    });

    // Test update
    if (tokens.length > 0) {
      const testToken = tokens[0];
      console.log(`Testing update on token: ${testToken.id.substring(0, 8)}...`);

      // Hide the token
      await connection.query(
        `UPDATE map_tokens SET is_visible_to_players = 0, transparency = 0.25 WHERE id = ?`,
        [testToken.id]
      );
      console.log("✓ Updated to hidden state (is_visible_to_players=0, transparency=0.25)");

      // Verify update
      const [updated] = await connection.query(
        `SELECT is_visible_to_players, transparency FROM map_tokens WHERE id = ?`,
        [testToken.id]
      );
      console.log(`Verified: visible=${updated[0].is_visible_to_players}, transparency=${updated[0].transparency}`);

      // Show the token again
      await connection.query(
        `UPDATE map_tokens SET is_visible_to_players = 1, transparency = 1.0 WHERE id = ?`,
        [testToken.id]
      );
      console.log("✓ Updated to visible state (is_visible_to_players=1, transparency=1.0)");

      // Verify update
      const [updated2] = await connection.query(
        `SELECT is_visible_to_players, transparency FROM map_tokens WHERE id = ?`,
        [testToken.id]
      );
      console.log(`Verified: visible=${updated2[0].is_visible_to_players}, transparency=${updated2[0].transparency}`);
    }

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await connection.end();
  }
}

testTokenVisibility();

