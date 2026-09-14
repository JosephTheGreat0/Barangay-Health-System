const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /audit-events  (called by other services after a write)
router.post('/audit-events', async (req, res) => {
  const { serviceName, entityType, entityId, action, payload } = req.body;
  if (!serviceName || !entityType || !action) {
    return res.status(400).json({ error: 'serviceName, entityType, action are required' });
  }
  const id = uuidv4();
  await pool.query(
    `INSERT INTO audit_events (id, service_name, entity_type, entity_id, action, performed_by, payload)
     VALUES (?,?,?,?,?,?,?)`,
    [id, serviceName, entityType, entityId || null, action, req.user.userId, payload ? JSON.stringify(payload) : null]
  );
  const [rows] = await pool.query('SELECT * FROM audit_events WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /audit-events?entity_id=
router.get('/audit-events', async (req, res) => {
  const { entity_id, entity_type } = req.query;
  let text = 'SELECT * FROM audit_events';
  const values = [];
  const conditions = [];
  if (entity_id) { values.push(entity_id); conditions.push('entity_id = ?'); }
  if (entity_type) { values.push(entity_type); conditions.push('entity_type = ?'); }
  if (conditions.length) text += ' WHERE ' + conditions.join(' AND ');
  text += ' ORDER BY created_at DESC LIMIT 200';
  const [rows] = await pool.query(text, values);
  res.json(rows);
});

module.exports = router;
