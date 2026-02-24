require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyRoleColumn() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'BlueStar6321',
    database: process.env.MYSQL_DATABASE || 'DNDTool'
  });

  const [cols] = await conn.execute('SHOW COLUMNS FROM users LIKE "role"');
  console.log('role column exists:', cols.length > 0);
  if (cols.length > 0) {
    console.log('role column type:', cols[0].Type, 'default:', cols[0].Default);
  }

  await conn.end();
}

verifyRoleColumn().catch((err) => {
  console.error(err);
  process.exit(1);
});

