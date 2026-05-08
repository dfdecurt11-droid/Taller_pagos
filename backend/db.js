const { Pool } = require('pg');

// Extraemos la URL y eliminamos cualquier espacio en blanco accidental
const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:database@localhost:5432/Admin_taller').trim();

const pool = new Pool({
    connectionString: connectionString,
    // SSL es obligatorio en Render. rejectUnauthorized: false permite la conexión segura
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Verificación de salud de la conexión
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión a la base de datos en Render:', err.message);
    } else {
        console.log('✅ Conexión exitosa. El backend ya puede realizar consultas.');
    }
});

module.exports = pool;