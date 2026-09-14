const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /appointments
router.post('/appointments', async (req, res) => {
  const { patientId, scheduledDate, scheduledTime, purpose, priorityLevel } = req.body;
  if (!patientId || !scheduledDate) return res.status(400).json({ error: 'patientId and scheduledDate are required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO appointments (id, patient_id, scheduled_date, scheduled_time, purpose, priority_level)
     VALUES (?,?,?,?,?,?)`,
    [id, patientId, scheduledDate, scheduledTime || null, purpose || null, priorityLevel || 'normal']
  );
  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /appointments?date=
router.get('/appointments', async (req, res) => {
  const { date } = req.query;
  const [rows] = date
    ? await pool.query('SELECT * FROM appointments WHERE scheduled_date = ? ORDER BY priority_level DESC, scheduled_time', [date])
    : await pool.query('SELECT * FROM appointments ORDER BY scheduled_date DESC LIMIT 50');
  res.json(rows);
});

// PATCH /appointments/:id/status
router.patch('/appointments/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['scheduled','checked_in','completed','cancelled','no_show'];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of ${valid.join(', ')}` });
  const [result] = await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// POST /queue/check-in
router.post('/queue/check-in', async (req, res) => {
  const { patientId, appointmentId } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  // Postgres cast COUNT(*)::int just kept the pg driver from returning a
  // bigint-as-string; mysql2 already returns COUNT(*) as a JS number, so no
  // cast is needed here.
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM queue_entries WHERE DATE(checked_in_at) = CURRENT_DATE`
  );
  const queueNumber = countRows[0].count + 1;
  const id = uuidv4();
  await pool.query(
    `INSERT INTO queue_entries (id, appointment_id, patient_id, queue_number) VALUES (?,?,?,?)`,
    [id, appointmentId || null, patientId, queueNumber]
  );
  if (appointmentId) {
    await pool.query(`UPDATE appointments SET status = 'checked_in' WHERE id = ?`, [appointmentId]);
  }
  const [rows] = await pool.query('SELECT * FROM queue_entries WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /queue?date=
router.get('/queue', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM queue_entries WHERE DATE(checked_in_at) = COALESCE(?, CURRENT_DATE) ORDER BY queue_number`,
    [req.query.date || null]
  );
  res.json(rows);
});

// PATCH /queue/:id/status
router.patch('/queue/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['waiting','in_consultation','done'];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of ${valid.join(', ')}` });
  const [result] = await pool.query('UPDATE queue_entries SET status = ? WHERE id = ?', [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  const [rows] = await pool.query('SELECT * FROM queue_entries WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
