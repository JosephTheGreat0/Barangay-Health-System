const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');

const router = express.Router();

<<<<<<< HEAD
function databaseSetupError(err) {
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return {
      status: 503,
      error: 'Database login failed. Check the MySQL username/password used to start auth-service.',
    };
  }
  if (err.code === 'ER_BAD_DB_ERROR') {
    return {
      status: 503,
      error: 'auth_db does not exist. Run npm run db:init with your real MySQL credentials.',
    };
  }
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return {
      status: 503,
      error: 'Auth database tables are missing. Run npm run db:init with your real MySQL credentials.',
    };
  }
  return null;
}

=======
>>>>>>> 1757e33af7c839619767a7e9b75a76677c5bfb53
// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, password, fullName, role, barangayId } = req.body;
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'username, password, fullName, role are required' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, full_name, role, barangay_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username, passwordHash, fullName, role, barangayId || null]
    );
    const [rows] = await pool.query(
      'SELECT id, username, full_name, role, barangay_id, created_at FROM users WHERE id = ?',
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // MySQL's duplicate-key error code, equivalent to Postgres's '23505'
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
<<<<<<< HEAD
    const setupError = databaseSetupError(err);
    if (setupError) return res.status(setupError.status).json({ error: setupError.error });
=======
>>>>>>> 1757e33af7c839619767a7e9b75a76677c5bfb53
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND is_active = true', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, role: user.role, barangayId: user.barangay_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } });
  } catch (err) {
<<<<<<< HEAD
    const setupError = databaseSetupError(err);
    if (setupError) return res.status(setupError.status).json({ error: setupError.error });
=======
>>>>>>> 1757e33af7c839619767a7e9b75a76677c5bfb53
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, full_name, role, barangay_id, created_at FROM users WHERE id = ?',
    [req.user.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

module.exports = router;
