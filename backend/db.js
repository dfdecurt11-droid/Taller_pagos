const { Pool } = require('pg');

// Usamos process.env.DATABASE_URL para que Render se conecte automáticamente
// Si no existe (en tu PC local), usará los datos que tenías
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:database@localhost:5432/Admin_taller',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;