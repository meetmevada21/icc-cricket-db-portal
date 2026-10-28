/**
 * ICC Cricket Database Management Portal - Local & Cloud MySQL Backend Server
 * Connects directly to your MySQL `icc_db` schema (8 ER Tables + 2 Views + Admins + Global Search).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create MySQL connection pool (supports both Local MySQL and Cloud MySQL with optional SSL)
const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'icc_db',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
};

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

// ----------------------------------------------------------------------------
// 0. Health Check, Admin Authentication & Full State Hydration
// ----------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS db, VERSION() AS version');
    res.json({ ok: true, connected: true, database: rows[0].db, version: rows[0].version });
  } catch (err) {
    res.status(500).json({ ok: false, connected: false, error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password are required' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT AdminID, Username, Role FROM admins WHERE LOWER(Username) = LOWER(?) AND PasswordHash = ? LIMIT 1',
      [username.trim(), password.trim()]
    );
    if (rows.length > 0) {
      return res.json({ ok: true, username: rows[0].Username, role: rows[0].Role });
    }
    return res.status(401).json({ ok: false, error: 'Invalid admin credentials' });
  } catch (err) {
    // Fallback if admins table is not yet created
    if (username.trim().toLowerCase() === 'admin' && password.trim() === 'icc2026') {
      return res.json({ ok: true, username: 'admin', role: 'ICC_SUPER_ADMIN' });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    const [tournaments] = await pool.query('SELECT * FROM tournaments ORDER BY TID ASC');
    const [tournament_types] = await pool.query('SELECT * FROM tournament_types ORDER BY TID ASC, Ttype ASC');
    const [matches] = await pool.query('SELECT * FROM matches ORDER BY match_date DESC, MID DESC');
    const [match_teams] = await pool.query('SELECT * FROM match_teams ORDER BY MID ASC, TeamName ASC');
    const [players] = await pool.query('SELECT * FROM players ORDER BY PID ASC');
    const [player_formats] = await pool.query('SELECT * FROM player_formats ORDER BY Format ASC, Ranking ASC');
    const [player_matches] = await pool.query('SELECT * FROM player_matches ORDER BY MID ASC, PID ASC');
    const [player_tournaments] = await pool.query('SELECT * FROM player_tournaments ORDER BY TID ASC, PID ASC');
    const [vw_player_rankings] = await pool.query('SELECT * FROM vw_player_rankings');
    const [vw_tournament_matches] = await pool.query('SELECT * FROM vw_tournament_matches');

    res.json({
      tournaments,
      tournament_types,
      matches,
      match_teams,
      players,
      player_formats,
      player_matches,
      player_tournaments,
      vw_player_rankings,
      vw_tournament_matches
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// GLOBAL SEARCH ENDPOINT ACROSS ALL 8 DATA TABLES + 2 SQL VIEWS
// ----------------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  const rawQ = (req.query.q || '').trim();
  const likeQ = `%${rawQ}%`;
  try {
    const [
      [tournaments],
      [tournament_types],
      [matches],
      [match_teams],
      [players],
      [player_formats],
      [player_matches],
      [player_tournaments],
      [vw_player_rankings],
      [vw_tournament_matches]
    ] = await Promise.all([
      pool.query(
        'SELECT * FROM tournaments WHERE CAST(TID AS CHAR) LIKE ? OR Tname LIKE ? OR Tduration LIKE ? ORDER BY TID ASC',
        [likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT tt.TID, tt.Ttype, t.Tname
         FROM tournament_types tt
         LEFT JOIN tournaments t ON tt.TID = t.TID
         WHERE CAST(tt.TID AS CHAR) LIKE ? OR tt.Ttype LIKE ? OR t.Tname LIKE ?
         ORDER BY tt.TID ASC, tt.Ttype ASC`,
        [likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT * FROM matches
         WHERE CAST(MID AS CHAR) LIKE ? OR match_date LIKE ? OR match_time LIKE ?
            OR mType LIKE ? OR Outcome LIKE ? OR CAST(TotalRuns AS CHAR) LIKE ?
            OR Umpires LIKE ? OR CAST(TID AS CHAR) LIKE ?
         ORDER BY match_date DESC, MID DESC`,
        [likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT mt.MID, mt.TeamName, m.match_date, m.mType, m.Outcome
         FROM match_teams mt
         LEFT JOIN matches m ON mt.MID = m.MID
         WHERE CAST(mt.MID AS CHAR) LIKE ? OR mt.TeamName LIKE ? OR m.mType LIKE ? OR m.Outcome LIKE ?
         ORDER BY mt.MID ASC, mt.TeamName ASC`,
        [likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT * FROM players
         WHERE CAST(PID AS CHAR) LIKE ? OR Pname LIKE ? OR Country LIKE ? OR CAST(Salary AS CHAR) LIKE ?
         ORDER BY PID ASC`,
        [likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT pf.PID, pf.Format, pf.Ranking, p.Pname, p.Country
         FROM player_formats pf
         LEFT JOIN players p ON pf.PID = p.PID
         WHERE CAST(pf.PID AS CHAR) LIKE ? OR pf.Format LIKE ? OR CAST(pf.Ranking AS CHAR) LIKE ?
            OR p.Pname LIKE ? OR p.Country LIKE ?
         ORDER BY pf.Format ASC, pf.Ranking ASC`,
        [likeQ, likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT pm.PID, pm.MID, p.Pname, p.Country, m.match_date, m.mType, m.Outcome
         FROM player_matches pm
         LEFT JOIN players p ON pm.PID = p.PID
         LEFT JOIN matches m ON pm.MID = m.MID
         WHERE CAST(pm.PID AS CHAR) LIKE ? OR CAST(pm.MID AS CHAR) LIKE ?
            OR p.Pname LIKE ? OR p.Country LIKE ? OR m.mType LIKE ? OR m.Outcome LIKE ?
         ORDER BY pm.MID ASC, pm.PID ASC`,
        [likeQ, likeQ, likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT pt.PID, pt.TID, p.Pname, p.Country, t.Tname, t.Tduration
         FROM player_tournaments pt
         LEFT JOIN players p ON pt.PID = p.PID
         LEFT JOIN tournaments t ON pt.TID = t.TID
         WHERE CAST(pt.PID AS CHAR) LIKE ? OR CAST(pt.TID AS CHAR) LIKE ?
            OR p.Pname LIKE ? OR p.Country LIKE ? OR t.Tname LIKE ?
         ORDER BY pt.TID ASC, pt.PID ASC`,
        [likeQ, likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT * FROM vw_player_rankings
         WHERE CAST(PID AS CHAR) LIKE ? OR Pname LIKE ? OR Country LIKE ?
            OR Format LIKE ? OR CAST(Ranking AS CHAR) LIKE ?`,
        [likeQ, likeQ, likeQ, likeQ, likeQ]
      ),
      pool.query(
        `SELECT * FROM vw_tournament_matches
         WHERE CAST(TID AS CHAR) LIKE ? OR Tname LIKE ? OR TournamentTypes LIKE ?
            OR CAST(MID AS CHAR) LIKE ? OR mType LIKE ? OR Teams LIKE ?
            OR Outcome LIKE ? OR Umpires LIKE ?`,
        [likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ]
      )
    ]);

    res.json({
      ok: true,
      query: rawQ,
      results: {
        tournaments,
        tournament_types,
        matches,
        match_teams,
        players,
        player_formats,
        player_matches,
        player_tournaments,
        vw_player_rankings,
        vw_tournament_matches
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 1. Tournaments & Tournament Types CRUD
// ----------------------------------------------------------------------------
app.post('/api/tournaments', async (req, res) => {
  const { TID, Tname, Tduration, types, playerPIDs } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO tournaments (TID, Tname, Tduration) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE Tname = VALUES(Tname), Tduration = VALUES(Tduration)',
      [TID, Tname, Tduration]
    );
    if (Array.isArray(types)) {
      await conn.query('DELETE FROM tournament_types WHERE TID = ?', [TID]);
      for (const t of types) {
        if (t && t.trim()) {
          await conn.query('INSERT INTO tournament_types (TID, Ttype) VALUES (?, ?)', [TID, t.trim()]);
        }
      }
    }
    if (Array.isArray(playerPIDs)) {
      await conn.query('DELETE FROM player_tournaments WHERE TID = ?', [TID]);
      for (const pid of playerPIDs) {
        await conn.query('INSERT INTO player_tournaments (PID, TID) VALUES (?, ?)', [Number(pid), TID]);
      }
    }
    await conn.commit();
    res.json({ ok: true, TID });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/tournaments/:tid', async (req, res) => {
  try {
    await pool.query('DELETE FROM tournaments WHERE TID = ?', [req.params.tid]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2. Matches & Match Teams CRUD
// ----------------------------------------------------------------------------
app.post('/api/matches', async (req, res) => {
  const { MID, match_date, match_time, mType, Outcome, TotalRuns, Umpires, TID, teams, squadPIDs } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO matches (MID, match_date, match_time, mType, Outcome, TotalRuns, Umpires, TID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         match_date = VALUES(match_date),
         match_time = VALUES(match_time),
         mType = VALUES(mType),
         Outcome = VALUES(Outcome),
         TotalRuns = VALUES(TotalRuns),
         Umpires = VALUES(Umpires),
         TID = VALUES(TID)`,
      [MID, match_date, match_time, mType, Outcome, TotalRuns || 0, Umpires || 'TBA', TID || null]
    );
    if (Array.isArray(teams)) {
      await conn.query('DELETE FROM match_teams WHERE MID = ?', [MID]);
      for (const team of teams) {
        if (team && team.trim()) {
          await conn.query('INSERT INTO match_teams (MID, TeamName) VALUES (?, ?)', [MID, team.trim()]);
        }
      }
    }
    if (Array.isArray(squadPIDs)) {
      await conn.query('DELETE FROM player_matches WHERE MID = ?', [MID]);
      for (const pid of squadPIDs) {
        await conn.query('INSERT INTO player_matches (PID, MID) VALUES (?, ?)', [Number(pid), MID]);
      }
    }
    await conn.commit();
    res.json({ ok: true, MID });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/matches/:mid', async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE MID = ?', [req.params.mid]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 3. Players & Player Formats / Tournaments / Matches CRUD
// ----------------------------------------------------------------------------
app.post('/api/players', async (req, res) => {
  const { PID, Pname, Country, Salary, formats, tournamentTIDs, matchMIDs } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO players (PID, Pname, Country, Salary)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         Pname = VALUES(Pname),
         Country = VALUES(Country),
         Salary = VALUES(Salary)`,
      [PID, Pname, Country, Salary]
    );
    if (Array.isArray(formats)) {
      await conn.query('DELETE FROM player_formats WHERE PID = ?', [PID]);
      for (const f of formats) {
        if (f.Format && f.Ranking) {
          await conn.query('INSERT INTO player_formats (PID, Format, Ranking) VALUES (?, ?, ?)', [PID, f.Format, Number(f.Ranking)]);
        }
      }
    }
    if (Array.isArray(tournamentTIDs)) {
      await conn.query('DELETE FROM player_tournaments WHERE PID = ?', [PID]);
      for (const tid of tournamentTIDs) {
        await conn.query('INSERT INTO player_tournaments (PID, TID) VALUES (?, ?)', [PID, Number(tid)]);
      }
    }
    if (Array.isArray(matchMIDs)) {
      await conn.query('DELETE FROM player_matches WHERE PID = ?', [PID]);
      for (const mid of matchMIDs) {
        await conn.query('INSERT INTO player_matches (PID, MID) VALUES (?, ?)', [PID, Number(mid)]);
      }
    }
    await conn.commit();
    res.json({ ok: true, PID });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/players/:pid', async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE PID = ?', [req.params.pid]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 4. Views Endpoints
// ----------------------------------------------------------------------------
app.get('/api/views/player-rankings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_player_rankings');
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/views/tournament-matches', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_tournament_matches');
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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
