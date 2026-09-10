const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

function forwardAuthHeader(req) {
  return { headers: { Authorization: req.headers.authorization } };
}

// POST /reports/generate  body: { month: "2026-09" }
// Pulls live counts from other services and stores a summary row.
router.post('/reports/generate', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) is required' });

  try {
    // NOTE: these are simple demo calls. In production, each of these
    // services would expose a proper "?month=" aggregate endpoint rather
    // than counting rows here — extend consultation/inventory/referral
    // services with their own /stats endpoints as you build them out.
    const [referrals] = await Promise.all([
      axios.get(`${process.env.REFERRAL_SERVICE_URL}/referrals`, forwardAuthHeader(req)),
    ]);

    const totalReferrals = referrals.data.filter(r => r.created_at.startsWith(month)).length;

    const reportMonth = `${month}-01`;
    // Postgres used INSERT ... ON CONFLICT (report_month) DO UPDATE ...
    // MySQL's equivalent upsert is INSERT ... ON DUPLICATE KEY UPDATE,
    // relying on the UNIQUE KEY on report_month declared in the schema.
    const id = uuidv4();
    await pool.query(
      `INSERT INTO monthly_summaries (id, report_month, total_referrals)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE total_referrals = VALUES(total_referrals), generated_at = CURRENT_TIMESTAMP`,
      [id, reportMonth, totalReferrals]
    );
    const [rows] = await pool.query('SELECT * FROM monthly_summaries WHERE report_month = ?', [reportMonth]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ error: 'Failed to pull data from one or more services', detail: err.message });
  }
});

// GET /reports/monthly?month=2026-09
router.get('/reports/monthly', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) query param is required' });
  const [rows] = await pool.query('SELECT * FROM monthly_summaries WHERE report_month = ?', [`${month}-01`]);
  if (!rows[0]) return res.status(404).json({ error: 'No report generated for this month yet. POST /reports/generate first.' });
  res.json(rows[0]);
});

module.exports = router;
