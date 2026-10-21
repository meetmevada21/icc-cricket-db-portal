/**
 * ICC Cricket Database Management Portal - Local MySQL Backend Server
 * Connects directly to your local MySQL `icc_db` schema from the ER diagram.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
// Explicit root route for Vercel serverless static fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only bind to a local port when run directly (not when imported by Vercel Serverless)
if (require.main === module) {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => {
    console.log(`ICC Cricket MySQL API & Web Portal running at http://localhost:${PORT}`);
  });
}

module.exports = app;
