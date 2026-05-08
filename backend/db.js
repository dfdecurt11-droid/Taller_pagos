const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Admin_taller', // El nombre que creaste
    password: 'database',     // Tu contraseña
    port: 5432,
});

module.exports = pool;