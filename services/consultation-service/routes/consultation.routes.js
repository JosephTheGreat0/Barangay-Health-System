const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

<<<<<<< HEAD
// GET /visits/stats/summary?date=2026-09-14&month=2026-09
router.get('/visits/stats/summary', async (req, res) => {
  const { date, month } = req.query;
  const [todayResult, monthResult] = await Promise.all([
    pool.query(
      'SELECT COUNT(DISTINCT patient_id) AS count FROM visits WHERE DATE(visit_date) = COALESCE(?, CURRENT_DATE)',
      [date || null]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM visits
       WHERE DATE_FORMAT(visit_date, '%Y-%m') = COALESCE(?, DATE_FORMAT(CURRENT_DATE, '%Y-%m'))`,
      [month || null]
    ),
  ]);
  res.json({
    patientsSeenToday: todayResult[0][0].count,
    totalVisits: monthResult[0][0].count,
  });
});

=======
>>>>>>> 1757e33af7c839619767a7e9b75a76677c5bfb53
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
