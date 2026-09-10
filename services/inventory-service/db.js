const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
});

pool.on('error', (err) => {
  console.error('Unexpected MySQL error', err);
});

module.exports = pool;
