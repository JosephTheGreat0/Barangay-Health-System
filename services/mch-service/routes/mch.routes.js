const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// --- Prenatal checkups ---
router.post('/prenatal-checkups', async (req, res) => {
  const { patientId, gestationalAgeWeeks, findings, nextVisitDate } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO prenatal_checkups (id, patient_id, gestational_age_weeks, findings, next_visit_date)
     VALUES (?,?,?,?,?)`,
    [id, patientId, gestationalAgeWeeks || null, findings || null, nextVisitDate || null]
  );
  const [rows] = await pool.query('SELECT * FROM prenatal_checkups WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

router.get('/prenatal-checkups', async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
  const [rows] = await pool.query(
    'SELECT * FROM prenatal_checkups WHERE patient_id = ? ORDER BY checkup_date DESC', [patient_id]
  );
  res.json(rows);
});

// --- Immunizations ---
router.post('/immunizations', async (req, res) => {
  const { patientId, vaccineName, doseNumber, dateGiven, nextDueDate } = req.body;
  if (!patientId || !vaccineName) return res.status(400).json({ error: 'patientId and vaccineName are required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO immunizations (id, patient_id, vaccine_name, dose_number, date_given, next_due_date)
     VALUES (?,?,?,?,?,?)`,
    [id, patientId, vaccineName, doseNumber || 1, dateGiven || new Date(), nextDueDate || null]
  );
  const [rows] = await pool.query('SELECT * FROM immunizations WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

router.get('/immunizations', async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
  const [rows] = await pool.query(
    'SELECT * FROM immunizations WHERE patient_id = ? ORDER BY date_given DESC', [patient_id]
  );
  res.json(rows);
});

// --- Growth records ---
router.post('/growth-records', async (req, res) => {
  const { patientId, ageMonths, heightCm, weightKg } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO growth_records (id, patient_id, age_months, height_cm, weight_kg)
     VALUES (?,?,?,?,?)`,
    [id, patientId, ageMonths || null, heightCm || null, weightKg || null]
  );
  const [rows] = await pool.query('SELECT * FROM growth_records WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

router.get('/growth-records', async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
  const [rows] = await pool.query(
    'SELECT * FROM growth_records WHERE patient_id = ? ORDER BY record_date DESC', [patient_id]
  );
  res.json(rows);
});

module.exports = router;
