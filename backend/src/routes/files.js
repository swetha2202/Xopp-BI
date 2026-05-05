const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const { pool } = require('../db');
const auth = require('../middleware/authMiddleware');
const { autoDetectMapping, normalizeRow } = require('../services/normalize');
const { v4: uuidv4 } = require('uuid');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel and CSV files allowed'));
  }
});

router.post('/upload', auth(['admin', 'operator', 'viewer']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, dateNF: 'yyyy-mm-dd' });

    if (!rows.length) return res.status(400).json({ error: 'File is empty' });

    const headers = Object.keys(rows[0]);
    const preview = rows.slice(0, 5);
    const suggestedMapping = autoDetectMapping(headers);

    const { rows: fileRows } = await pool.query(
      `INSERT INTO source_files (file_name, original_name, status, row_count, uploaded_by)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING *`,
      [req.file.originalname, req.file.originalname, rows.length, req.user.id]
    );

    await pool.query(
      `UPDATE source_files SET mapping_config = $1 WHERE id = $2`,
      [JSON.stringify({ rawData: rows, headers }), fileRows[0].id]
    );

    res.json({ file: fileRows[0], headers, preview, suggestedMapping, totalRows: rows.length });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:fileId/process', auth(['admin', 'operator', 'viewer']), async (req, res) => {
  const { fileId } = req.params;
  const { mapping, defaultEmirate, defaultPropertyType } = req.body;

  try {
    const { rows: fileRows } = await pool.query('SELECT * FROM source_files WHERE id = $1', [fileId]);
    if (!fileRows.length) return res.status(404).json({ error: 'File not found' });

    const fileRecord = fileRows[0];

    if (fileRecord.status === 'completed') return res.status(400).json({ error: 'File already processed' });
    if (fileRecord.status === 'processing') return res.status(400).json({ error: 'File is already being processed' });

    const rawData = fileRecord.mapping_config?.rawData;
    if (!rawData || !rawData.length) return res.status(400).json({ error: 'No data found for this file. Please re-upload.' });

    await pool.query(
      "UPDATE source_files SET status = 'processing', mapping_config = $1 WHERE id = $2",
      [JSON.stringify({ ...fileRecord.mapping_config, confirmedMapping: mapping }), fileId]
    );

    res.json({ message: 'Processing started', fileId });

    processFile(fileId, rawData, mapping, req.user.id, defaultEmirate || null, defaultPropertyType || null).catch(console.error);
  } catch (err) {
    console.error('Process route error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function processFile(fileId, rawData, mapping, userId, defaultEmirate, defaultPropertyType) {
  const client = await pool.connect();
  try {
    let processed = 0, duplicates = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const batch = rawData.slice(i, i + BATCH_SIZE);

      await client.query('BEGIN');
      try {
        for (const row of batch) {
          const normalized = normalizeRow(row, mapping);

          // Apply file-level defaults for emirate and property_type
          const emirate = defaultEmirate ? defaultEmirate.toUpperCase() : null;
          const propertyType = defaultPropertyType ? defaultPropertyType.toUpperCase() : null;

          let customerId = null;

          if (normalized.phone || normalized.email) {
            const existing = await client.query(
              `SELECT id FROM customers WHERE 
                (phone IS NOT NULL AND phone = $1) OR 
                (email IS NOT NULL AND email = $2)
               LIMIT 1`,
              [normalized.phone || null, normalized.email || null]
            );

            if (existing.rows.length) {
              customerId = existing.rows[0].id;
              await client.query(
                `UPDATE customers SET 
                  name = COALESCE(name, $1),
                  phone = COALESCE(phone, $2),
                  email = COALESCE(email, $3),
                  nationality = COALESCE(nationality, $4),
                  source_file_ids = array_append(source_file_ids, $5::uuid),
                  updated_at = NOW()
                 WHERE id = $6`,
                [normalized.name, normalized.phone, normalized.email,
                normalized.nationality, fileId, customerId]
              );
            }
          }

          if (!customerId) {
            let inserted = false;
            while (!inserted) {
              const seqRes = await client.query(`SELECT nextval('customer_id_seq')`);
              const customerIdStr = `CUST-${String(seqRes.rows[0].nextval).padStart(6, '0')}`;

              const { rows: newCustomer } = await client.query(
                `INSERT INTO customers (customer_id, name, phone, email, nationality, source_file_ids)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (customer_id) DO NOTHING
                 RETURNING id`,
                [customerIdStr, normalized.name, normalized.phone,
                  normalized.email, normalized.nationality, [fileId]]
              );
              if (newCustomer.length) {
                customerId = newCustomer[0].id;
                inserted = true;
              }
            }
          }

          let isDuplicate = false;
          if (normalized.project && normalized.unit) {
            const dupCheck = await client.query(
              `SELECT id FROM ownership WHERE customer_id = $1 AND project = $2 AND unit = $3 LIMIT 1`,
              [customerId, normalized.project, normalized.unit]
            );
            if (dupCheck.rows.length) {
              isDuplicate = true;
              duplicates++;
            }
          }

          await client.query(
            `INSERT INTO ownership (customer_id, project, unit, unit_type, registration_date, source_file_id, is_duplicate, emirate, property_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [customerId, normalized.project, normalized.unit, normalized.unit_type,
              normalized.registration_date, fileId, isDuplicate, emirate, propertyType]
          );

          processed++;
        }

        await client.query(
          `UPDATE source_files SET processed_count = $1, duplicate_count = $2 WHERE id = $3`,
          [processed, duplicates, fileId]
        );

        await client.query('COMMIT');
      } catch (batchErr) {
        await client.query('ROLLBACK');
        throw batchErr;
      }
    }

    await pool.query(
      `UPDATE source_files SET status = 'completed', processed_count = $1, duplicate_count = $2 WHERE id = $3`,
      [processed, duplicates, fileId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'file_processed', 'source_file', $2, $3)`,
      [userId, fileId, JSON.stringify({ processed, duplicates })]
    );

    console.log(`✅ File ${fileId} processed: ${processed} rows, ${duplicates} duplicates`);
  } catch (err) {
    await pool.query(
      "UPDATE source_files SET status = 'error', error_message = $1 WHERE id = $2",
      [err.message, fileId]
    );
    console.error('Processing error:', err);
  } finally {
    client.release();
  }
}

router.get('/', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(
        `SELECT sf.id, sf.original_name, sf.status, sf.row_count, sf.processed_count,
                  sf.duplicate_count, sf.upload_date, sf.error_message, u.name as uploaded_by_name
           FROM source_files sf
           LEFT JOIN users u ON sf.uploaded_by = u.id
           ORDER BY sf.upload_date DESC`
      )
      : await pool.query(
        `SELECT sf.id, sf.original_name, sf.status, sf.row_count, sf.processed_count,
                  sf.duplicate_count, sf.upload_date, sf.error_message, u.name as uploaded_by_name
           FROM source_files sf
           LEFT JOIN users u ON sf.uploaded_by = u.id
           WHERE sf.uploaded_by = $1
           ORDER BY sf.upload_date DESC`,
        [req.user.id]
      );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:fileId/status', auth(), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = isAdmin
      ? await pool.query(
        `SELECT id, original_name, status, row_count, processed_count, duplicate_count, error_message
           FROM source_files WHERE id = $1`,
        [req.params.fileId]
      )
      : await pool.query(
        `SELECT id, original_name, status, row_count, processed_count, duplicate_count, error_message
           FROM source_files WHERE id = $1 AND uploaded_by = $2`,
        [req.params.fileId, req.user.id]
      );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:fileId', auth(), async (req, res) => {
  const client = await pool.connect();
  try {
    // Check the file exists and belongs to this user (unless admin)
    const isAdmin = req.user.role === 'admin';
    const { rows } = await client.query(
      'SELECT id, uploaded_by FROM source_files WHERE id = $1',
      [req.params.fileId]
    );
    if (!rows.length) return res.status(404).json({ error: 'File not found' });
    if (!isAdmin && rows[0].uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own files' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM ownership WHERE source_file_id = $1', [req.params.fileId]);
    // Delete customers who no longer have any ownership records
    await client.query(`
      DELETE FROM customers
      WHERE id NOT IN (SELECT DISTINCT customer_id FROM ownership WHERE customer_id IS NOT NULL)
    `);
    await client.query('DELETE FROM source_files WHERE id = $1', [req.params.fileId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;