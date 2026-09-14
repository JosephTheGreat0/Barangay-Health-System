const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../authMiddleware');
const router = express.Router();

router.use(requireAuth);

// POST /stock-items
router.post('/stock-items', async (req, res) => {
  const { itemName, unit, quantityOnHand, expiryDate, reorderLevel } = req.body;
  if (!itemName || !unit) return res.status(400).json({ error: 'itemName and unit are required' });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO stock_items (id, item_name, unit, quantity_on_hand, expiry_date, reorder_level)
     VALUES (?,?,?,?,?,?)`,
    [id, itemName, unit, quantityOnHand || 0, expiryDate || null, reorderLevel || 10]
  );
  const [rows] = await pool.query('SELECT * FROM stock_items WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

// GET /stock-items
router.get('/stock-items', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM stock_items ORDER BY item_name');
  res.json(rows);
});

// GET /stock-items/expiring-soon?days=30
router.get('/stock-items/expiring-soon', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  // Postgres: CURRENT_DATE + $1::int (integer days added directly to a date).
  // MySQL has no date-plus-integer arithmetic; use DATE_ADD with an INTERVAL.
  const [rows] = await pool.query(
    `SELECT * FROM stock_items WHERE expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
     ORDER BY expiry_date`, [days]
  );
  res.json(rows);
});

// GET /stock-transactions/stats/summary?month=2026-09
router.get('/stock-transactions/stats/summary', async (req, res) => {
  const { month } = req.query;
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0) AS totalDispensedItems
     FROM stock_transactions
     WHERE transaction_type = 'dispense'
       AND DATE_FORMAT(created_at, '%Y-%m') = COALESCE(?, DATE_FORMAT(CURRENT_DATE, '%Y-%m'))`,
    [month || null]
  );
  res.json({ totalDispensedItems: rows[0].totalDispensedItems || 0 });
});

// POST /stock-transactions/dispense
router.post('/stock-transactions/dispense', async (req, res) => {
  const { itemId, quantity, patientId, referenceVisitId } = req.body;
  if (!itemId || !quantity) return res.status(400).json({ error: 'itemId and quantity are required' });

  // mysql2 transaction pattern: pool.getConnection() + beginTransaction()/
  // commit()/rollback() replaces pg's pool.connect() + BEGIN/COMMIT/ROLLBACK
  // text queries. SELECT ... FOR UPDATE still works the same way on InnoDB.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [itemRows] = await conn.query('SELECT * FROM stock_items WHERE id = ? FOR UPDATE', [itemId]);
    if (!itemRows[0]) throw { status: 404, message: 'Stock item not found' };
    if (itemRows[0].quantity_on_hand < quantity) throw { status: 400, message: 'Insufficient stock' };

    await conn.query('UPDATE stock_items SET quantity_on_hand = quantity_on_hand - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, itemId]);
    const txId = uuidv4();
    await conn.query(
      `INSERT INTO stock_transactions (id, item_id, transaction_type, quantity, patient_id, reference_visit_id)
       VALUES (?,?,'dispense',?,?,?)`,
      [txId, itemId, quantity, patientId || null, referenceVisitId || null]
    );
    await conn.commit();
    const [txRows] = await pool.query('SELECT * FROM stock_transactions WHERE id = ?', [txId]);
    res.status(201).json(txRows[0]);
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message || 'Dispense failed' });
  } finally {
    conn.release();
  }
});

// POST /stock-transactions/restock
router.post('/stock-transactions/restock', async (req, res) => {
  const { itemId, quantity } = req.body;
  if (!itemId || !quantity) return res.status(400).json({ error: 'itemId and quantity are required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE stock_items SET quantity_on_hand = quantity_on_hand + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, itemId]);
    const txId = uuidv4();
    await conn.query(
      `INSERT INTO stock_transactions (id, item_id, transaction_type, quantity) VALUES (?,?,'restock',?)`,
      [txId, itemId, quantity]
    );
    await conn.commit();
    const [txRows] = await pool.query('SELECT * FROM stock_transactions WHERE id = ?', [txId]);
    res.status(201).json(txRows[0]);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Restock failed' });
  } finally {
    conn.release();
  }
});

module.exports = router;
