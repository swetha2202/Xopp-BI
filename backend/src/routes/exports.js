const router = require('express').Router();
const XLSX = require('xlsx');
const { pool } = require('../db');
const auth = require('../middleware/authMiddleware');

function toExcel(data, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Export customer master list
router.get('/customers', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.customer_id, c.name, c.phone, c.email, c.nationality,
      COUNT(o.id) FILTER (WHERE NOT o.is_duplicate) as property_count,
      c.created_at
     FROM customers c
     LEFT JOIN ownership o ON o.customer_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC`
  );

  const data = rows.map(r => ({
    'Customer ID': r.customer_id,
    'Name': r.name,
    'Phone': r.phone,
    'Email': r.email,
    'Nationality': r.nationality,
    'Properties': r.property_count,
    'Created': r.created_at ? new Date(r.created_at).toLocaleDateString() : ''
  }));

  const buffer = toExcel(data, 'Customers');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=customers_master.xlsx');
  res.send(buffer);
});

// Export property master list
router.get('/properties', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.customer_id, c.name, c.phone, c.email,
      o.project, o.unit, o.unit_type, o.registration_date,
      sf.original_name as source_file
     FROM ownership o
     JOIN customers c ON o.customer_id = c.id
     LEFT JOIN source_files sf ON o.source_file_id = sf.id
     WHERE NOT o.is_duplicate
     ORDER BY c.customer_id, o.project`
  );

  const data = rows.map(r => ({
    'Customer ID': r.customer_id,
    'Owner Name': r.name,
    'Phone': r.phone,
    'Email': r.email,
    'Project': r.project,
    'Unit': r.unit,
    'Type': r.unit_type,
    'Registration Date': r.registration_date || '',
    'Source File': r.source_file
  }));

  const buffer = toExcel(data, 'Properties');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=properties_master.xlsx');
  res.send(buffer);
});

// Export duplicates report
router.get('/duplicates', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.customer_id, c.name, c.phone, c.email,
      o.project, o.unit, o.unit_type, sf.original_name as source_file, o.created_at
     FROM ownership o
     JOIN customers c ON o.customer_id = c.id
     LEFT JOIN source_files sf ON o.source_file_id = sf.id
     WHERE o.is_duplicate = true
     ORDER BY c.customer_id, o.project`
  );

  const data = rows.map(r => ({
    'Customer ID': r.customer_id,
    'Owner Name': r.name,
    'Phone': r.phone,
    'Email': r.email,
    'Project': r.project,
    'Unit': r.unit,
    'Type': r.unit_type,
    'Source File': r.source_file,
    'Detected At': r.created_at ? new Date(r.created_at).toLocaleDateString() : ''
  }));

  const buffer = toExcel(data, 'Duplicates');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=duplicates_report.xlsx');
  res.send(buffer);
});

module.exports = router;