const mysql = require('mysql2/promise');

async function verifyBugReportsTable() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'BlueStar6321',
      database: 'DNDTool'
    });

    const [rows] = await conn.execute('SHOW TABLES LIKE "bug_reports"');

    if (rows.length > 0) {
      console.log('✅ bug_reports table exists');

      const [cols] = await conn.execute('DESCRIBE bug_reports');
      console.log('\n📋 Table Columns:');
      cols.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });

      const [tableInfo] = await conn.execute('SHOW CREATE TABLE bug_reports');
      console.log('\n🔍 Table Details:');
      console.log(tableInfo[0]['Create Table']);
    } else {
      console.log('❌ bug_reports table does NOT exist');
    }

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyBugReportsTable();

