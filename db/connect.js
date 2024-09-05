const mysql = require("mysql2");
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  ssl: {
    // This is to ensure SSL is enabled for secure connections, had to deactivate it because of my node.js
    rejectUnauthorized: false,
  },
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the Aiven MySQL database");
});

module.exports = connection;
