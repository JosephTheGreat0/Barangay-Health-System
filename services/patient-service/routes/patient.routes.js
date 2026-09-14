const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /households
router.post('/households', async (req, res) => {
  const { address, barangay } = req.body;
  if (!address || !barangay) return res.status(400).json({ error: 'address and barangay are required' });
  const id = uuidv4();
  await pool.query('INSERT INTO households (id, address, barangay) VALUES (?, ?, ?)', [id, address, barangay]);
  const [rows] = await pool.query('SELECT * FROM households WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

router.get('/households/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM households WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /patients
router.post('/patients', async (req, res) => {
  const { householdId, firstName, lastName, birthdate, sex, contactNumber, isPwd, isPregnant } = req.body;
  if (!firstName || !lastName || !birthdate || !sex) {
    return res.status(400).json({ error: 'firstName, lastName, birthdate, sex are required' });
  }
  const id = uuidv4();
  await pool.query(
    `INSERT INTO patients (id, household_id, first_name, last_name, birthdate, sex, contact_number, is_pwd, is_pregnant)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, householdId || null, firstName, lastName, birthdate, sex, contactNumber || null, !!isPwd, !!isPregnant]
  );
  const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /patients/:id
router.get('/patients/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// GET /patients?search=
router.get('/patients', async (req, res) => {
  const { search } = req.query;
  if (search) {
    // MySQL's default collation (utf8mb4_0900_ai_ci) is already case-insensitive,
    // so plain LIKE does the job ILIKE did in Postgres.
    const [rows] = await pool.query(
      `SELECT * FROM patients WHERE first_name LIKE ? OR last_name LIKE ? ORDER BY last_name LIMIT 50`,
      [`%${search}%`, `%${search}%`]
    );
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 50');
  res.json(rows);
});

// PUT /patients/:id
router.put('/patients/:id', async (req, res) => {
  const { firstName, lastName, contactNumber, isPwd, isPregnant } = req.body;
  // mysql2 rejects `undefined` bind params outright (pg silently treated them
  // as NULL), so any field the caller omitted needs to be normalized to null
  // here for the COALESCE(...) fallbacks below to work the same way.
  const [result] = await pool.query(
    `UPDATE patients SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       contact_number = COALESCE(?, contact_number),
       is_pwd = COALESCE(?, is_pwd),
       is_pregnant = COALESCE(?, is_pregnant),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [firstName ?? null, lastName ?? null, contactNumber ?? null, isPwd ?? null, isPregnant ?? null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
