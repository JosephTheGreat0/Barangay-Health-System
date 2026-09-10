const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /referrals
router.post('/referrals', async (req, res) => {
  const { patientId, visitId, reason, destinationFacility, referringProvider } = req.body;
  if (!patientId || !reason || !destinationFacility) {
    return res.status(400).json({ error: 'patientId, reason, destinationFacility are required' });
  }
  const id = uuidv4();
  await pool.query(
    `INSERT INTO referrals (id, patient_id, visit_id, reason, destination_facility, referring_provider)
     VALUES (?,?,?,?,?,?)`,
    [id, patientId, visitId || null, reason, destinationFacility, referringProvider || null]
  );
  const [rows] = await pool.query('SELECT * FROM referrals WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /referrals/:id
router.get('/referrals/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM referrals WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// GET /referrals?patient_id=
router.get('/referrals', async (req, res) => {
  const { patient_id, status } = req.query;
  let text = 'SELECT * FROM referrals';
  const values = [];
  const conditions = [];
  if (patient_id) { values.push(patient_id); conditions.push('patient_id = ?'); }
  if (status) { values.push(status); conditions.push('status = ?'); }
  if (conditions.length) text += ' WHERE ' + conditions.join(' AND ');
  text += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(text, values);
  res.json(rows);
});

// PATCH /referrals/:id/status
router.patch('/referrals/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','sent','acknowledged','completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of ${valid.join(', ')}` });
  const [result] = await pool.query('UPDATE referrals SET status = ? WHERE id = ?', [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  const [rows] = await pool.query('SELECT * FROM referrals WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
