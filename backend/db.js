const { Pool } = require('pg');

const pool = new Pool({
    // Configuración local explícita usando tus credenciales actuales
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:database@localhost:5432/taller-sandra',
    // Manejo automático de certificados SSL solo si estás desplegado en Render
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;