const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /visits
router.post('/visits', async (req, res) => {
  const { patientId, notes } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO visits (id, patient_id, attending_user_id, notes) VALUES (?, ?, ?, ?)`,
    [id, patientId, req.user.userId, notes || null]
  );
  const [rows] = await pool.query('SELECT * FROM visits WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /visits/:id  (includes vitals, diagnoses, prescriptions)
router.get('/visits/:id', async (req, res) => {
  const [visitRows] = await pool.query('SELECT * FROM visits WHERE id = ?', [req.params.id]);
  if (!visitRows[0]) return res.status(404).json({ error: 'Not found' });
  const [[vitals], [diagnoses], [prescriptions]] = await Promise.all([
    pool.query('SELECT * FROM vitals WHERE visit_id = ? ORDER BY recorded_at DESC', [req.params.id]),
    pool.query('SELECT * FROM diagnoses WHERE visit_id = ?', [req.params.id]),
    pool.query('SELECT * FROM prescriptions WHERE visit_id = ?', [req.params.id]),
  ]);
  res.json({ ...visitRows[0], vitals, diagnoses, prescriptions });
});

// GET /visits?patient_id=
router.get('/visits', async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id query param is required' });
  const [rows] = await pool.query('SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC', [patient_id]);
  res.json(rows);
});

// POST /visits/:id/vitals
router.post('/visits/:id/vitals', async (req, res) => {
  const { heightCm, weightKg, bloodPressure, temperatureC, pulseRate } = req.body;
  const id = uuidv4();
  await pool.query(
    `INSERT INTO vitals (id, visit_id, height_cm, weight_kg, blood_pressure, temperature_c, pulse_rate)
     VALUES (?,?,?,?,?,?,?)`,
    [id, req.params.id, heightCm || null, weightKg || null, bloodPressure || null, temperatureC || null, pulseRate || null]
  );
  const [rows] = await pool.query('SELECT * FROM vitals WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// POST /visits/:id/diagnoses
router.post('/visits/:id/diagnoses', async (req, res) => {
  const { diagnosisText } = req.body;
  if (!diagnosisText) return res.status(400).json({ error: 'diagnosisText is required' });
  const id = uuidv4();
  await pool.query(
    'INSERT INTO diagnoses (id, visit_id, diagnosis_text) VALUES (?, ?, ?)',
    [id, req.params.id, diagnosisText]
  );
  const [rows] = await pool.query('SELECT * FROM diagnoses WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// POST /visits/:id/prescriptions
router.post('/visits/:id/prescriptions', async (req, res) => {
  const { medicineName, dosage, quantity, instructions } = req.body;
  if (!medicineName || !quantity) return res.status(400).json({ error: 'medicineName and quantity are required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO prescriptions (id, visit_id, medicine_name, dosage, quantity, instructions)
     VALUES (?,?,?,?,?,?)`,
    [id, req.params.id, medicineName, dosage || null, quantity, instructions || null]
  );
  const [rows] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

module.exports = router;
