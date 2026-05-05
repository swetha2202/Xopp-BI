const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // FIX 5: rejectUnauthorized true to verify SSL cert in production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS source_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name VARCHAR(500) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        upload_date TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','mapping','processing','completed','error')),
        row_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        uploaded_by UUID REFERENCES users(id),
        mapping_config JSONB,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(500),
        phone VARCHAR(50),
        email VARCHAR(255),
        nationality VARCHAR(100),
        source_file_ids UUID[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ownership (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        project VARCHAR(500),
        unit VARCHAR(200),
        unit_type VARCHAR(100),
        registration_date DATE,
        area VARCHAR(255),
        land_number VARCHAR(100),
        land_sub_number VARCHAR(100),
        actual_area NUMERIC(12,2),
        property_sub_type VARCHAR(100),
        zip_code VARCHAR(50),
        emirate VARCHAR(100),
        property_type VARCHAR(100),
        source_file_id UUID REFERENCES source_files(id),
        is_duplicate BOOLEAN DEFAULT FALSE,
        merged_into UUID REFERENCES ownership(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_customer ON ownership(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_project_unit ON ownership(project, unit);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
      CREATE SEQUENCE IF NOT EXISTS customer_id_seq START 1;
    `);

    // Migrate existing databases: add missing columns if not present
    await client.query(`
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS emirate VARCHAR(100);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS property_type VARCHAR(100);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS area VARCHAR(255);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS land_number VARCHAR(100);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS land_sub_number VARCHAR(100);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS actual_area NUMERIC(12,2);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS property_sub_type VARCHAR(100);
      ALTER TABLE ownership ADD COLUMN IF NOT EXISTS zip_code VARCHAR(50);
    `);

    // FIX 1: Default admin removed — create your admin manually via the API
    // or uncomment the block below only for the very first deploy, then remove it again.
    //
    // const bcrypt = require('bcryptjs');
    // const adminCheck = await client.query("SELECT id FROM users WHERE email = 'admin@pmdb.com'");
    // if (adminCheck.rows.length === 0) {
    //   const hash = await bcrypt.hash('CHANGE_THIS_PASSWORD', 10);
    //   await client.query(
    //     "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
    //     ['System Admin', 'admin@pmdb.com', hash, 'admin']
    //   );
    // }

    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };