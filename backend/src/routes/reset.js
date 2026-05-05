const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/authMiddleware');

// Full reset — admin only
// DELETE /api/reset/all
router.delete('/all', auth(['admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete in correct foreign-key order
        await client.query('DELETE FROM audit_log');
        await client.query('DELETE FROM ownership');
        await client.query('DELETE FROM customers');
        await client.query('DELETE FROM source_files');

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'All data has been reset successfully.',
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;