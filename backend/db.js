const { Pool } = require('pg');

/**
 * CONFIGURACIÓN DE CONEXIÓN
 * En Render, se usará la variable de entorno DATABASE_URL.
 * En tu PC local, usará tu cadena de conexión de siempre.
 */
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:database@localhost:5432/Admin_taller';

const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Esto imprimirá en los LOGS de Render a qué base de datos se conectó
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Error adquiriendo el cliente:', err.stack);
    }
    client.query('SELECT current_database(), current_user', (err, result) => {
        release();
        if (err) {
            return console.error('❌ Error ejecutando la consulta de prueba:', err.stack);
        }
        console.log('✅ Conexión exitosa a la DB:', result.rows[0].current_database);
        console.log('👤 Usuario de DB activo:', result.rows[0].current_user);
    });
});

module.exports = pool;