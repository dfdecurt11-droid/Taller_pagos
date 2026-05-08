const { Pool } = require('pg');

// La lógica es: Si existe DATABASE_URL (estamos en Render), úsala.
// Si no existe, usa la configuración local de tu PC.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:database@localhost:5432/Admin_taller',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Verificación de conexión en la consola para saber qué base de datos está usando
pool.query('SELECT current_database()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión a la DB:', err.stack);
    } else {
        console.log('✅ Conectado a la base de datos:', res.rows[0].current_database);
    }
});

module.exports = pool;