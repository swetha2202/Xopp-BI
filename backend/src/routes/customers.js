const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/authMiddleware');

// Search customers
router.get('/', auth(), async (req, res) => {
  try {
    const { q, nationality, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.role === 'admin';

    let where = [];
    let params = [];
    let i = 1;

    // Non-admins only see customers linked to their uploaded files
    if (!isAdmin) {
      where.push(`EXISTS (
        SELECT 1 FROM ownership o
        JOIN source_files sf ON o.source_file_id = sf.id
        WHERE o.customer_id = c.id AND sf.uploaded_by = $${i}
      )`);
      params.push(req.user.id); i++;
    }

    if (q) {
      where.push(`(c.name ILIKE $${i} OR c.phone ILIKE $${i} OR c.email ILIKE $${i} OR c.customer_id ILIKE $${i})`);
      params.push(`%${q}%`); i++;
    }
    if (nationality) {
      where.push(`c.nationality = $${i}`);
      params.push(nationality); i++;
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM customers c ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM ownership o WHERE o.customer_id = c.id AND NOT o.is_duplicate) as property_count
       FROM customers c
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      params
    );

    res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get duplicates summary
router.get('/duplicates/list', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? `SELECT o.*, c.name as customer_name, c.customer_id, c.phone, c.email,
           sf.original_name as source_file_name
         FROM ownership o
         JOIN customers c ON o.customer_id = c.id
         LEFT JOIN source_files sf ON o.source_file_id = sf.id
         WHERE o.is_duplicate = true
         ORDER BY o.created_at DESC LIMIT 500`
      : `SELECT o.*, c.name as customer_name, c.customer_id, c.phone, c.email,
           sf.original_name as source_file_name
         FROM ownership o
         JOIN customers c ON o.customer_id = c.id
         LEFT JOIN source_files sf ON o.source_file_id = sf.id
         WHERE o.is_duplicate = true AND sf.uploaded_by = $1
         ORDER BY o.created_at DESC LIMIT 500`;

    const { rows } = await pool.query(query, isAdmin ? [] : [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
router.get('/stats/summary', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    let customers, properties, duplicates, files;
    if (isAdmin) {
      [customers, properties, duplicates, files] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM customers'),
        pool.query('SELECT COUNT(*) FROM ownership WHERE is_duplicate = false'),
        pool.query('SELECT COUNT(*) FROM ownership WHERE is_duplicate = true'),
        pool.query("SELECT COUNT(*) FROM source_files WHERE status = 'completed'"),
      ]);
    } else {
      [customers, properties, duplicates, files] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT o.customer_id) FROM ownership o
           JOIN source_files sf ON o.source_file_id = sf.id
           WHERE sf.uploaded_by = $1`, [req.user.id]),
        pool.query(
          `SELECT COUNT(*) FROM ownership o
           JOIN source_files sf ON o.source_file_id = sf.id
           WHERE o.is_duplicate = false AND sf.uploaded_by = $1`, [req.user.id]),
        pool.query(
          `SELECT COUNT(*) FROM ownership o
           JOIN source_files sf ON o.source_file_id = sf.id
           WHERE o.is_duplicate = true AND sf.uploaded_by = $1`, [req.user.id]),
        pool.query(
          `SELECT COUNT(*) FROM source_files WHERE status = 'completed' AND uploaded_by = $1`, [req.user.id]),
      ]);
    }

    res.json({
      totalCustomers: parseInt(customers.rows[0].count),
      totalProperties: parseInt(properties.rows[0].count),
      totalDuplicates: parseInt(duplicates.rows[0].count),
      processedFiles: parseInt(files.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent properties list
router.get('/properties/recent', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const limit = parseInt(req.query.limit) || 50;

    const query = isAdmin
      ? `SELECT o.id, o.project, o.unit, o.unit_type, o.land_number,
              o.emirate, o.property_type, o.registration_date,
              c.name as _customerName, c.customer_id as _customerId, c.id as _id
         FROM ownership o
         JOIN customers c ON o.customer_id = c.id
         WHERE o.is_duplicate = false
         ORDER BY o.created_at DESC LIMIT $1`
      : `SELECT o.id, o.project, o.unit, o.unit_type, o.land_number,
              o.emirate, o.property_type, o.registration_date,
              c.name as _customerName, c.customer_id as _customerId, c.id as _id
         FROM ownership o
         JOIN customers c ON o.customer_id = c.id
         JOIN source_files sf ON o.source_file_id = sf.id
         WHERE o.is_duplicate = false AND sf.uploaded_by = $1
         ORDER BY o.created_at DESC LIMIT $2`;

    const { rows } = await pool.query(query, isAdmin ? [limit] : [req.user.id, limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer by ID with properties
router.get('/:id', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id);

    let customers;
    if (isUUID) {
      ({ rows: customers } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]));
    } else {
      ({ rows: customers } = await pool.query('SELECT * FROM customers WHERE customer_id = $1', [req.params.id]));
    }

    if (!customers.length) return res.status(404).json({ error: 'Customer not found' });
    const customer = customers[0];

    // Non-admins: block access if customer has no ownership linked to their files
    if (!isAdmin) {
      const access = await pool.query(
        `SELECT 1 FROM ownership o
         JOIN source_files sf ON o.source_file_id = sf.id
         WHERE o.customer_id = $1 AND sf.uploaded_by = $2 LIMIT 1`,
        [customer.id, req.user.id]
      );
      if (!access.rows.length) return res.status(403).json({ error: 'Access denied' });
    }

    const { rows: properties } = await pool.query(
      `SELECT o.*, sf.original_name as source_file_name
       FROM ownership o
       LEFT JOIN source_files sf ON o.source_file_id = sf.id
       WHERE o.customer_id = $1::uuid
       ORDER BY o.created_at DESC`,
      [customer.id]
    );

    res.json({ ...customer, properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update customer
router.put('/:id', auth(['admin', 'operator']), async (req, res) => {
  try {
    const { name, phone, email, nationality } = req.body;
    const { rows } = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, nationality=$4, updated_at=NOW()
       WHERE id=$5::uuid RETURNING *`,
      [name, phone, email, nationality, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete single customer (admin only)
router.delete('/:id', auth(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ownership WHERE customer_id = $1::uuid', [req.params.id]);
    const { rows } = await client.query('DELETE FROM customers WHERE id = $1::uuid RETURNING id', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// Bulk delete customers (admin only)
router.post('/delete-multiple', auth(['admin']), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ownership WHERE customer_id = ANY($1::uuid[])', [ids]);
    const { rowCount } = await client.query('DELETE FROM customers WHERE id = ANY($1::uuid[])', [ids]);
    await client.query('COMMIT');
    res.json({ success: true, deletedCount: rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;