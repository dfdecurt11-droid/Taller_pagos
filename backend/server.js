const express = require('express');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');
const path = require('path');

const app = express();

// =====================================================
// CONFIGURACIÓN DE MIDDLEWARES
// =====================================================
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// NOTA: No ponemos el express.static aquí arriba porque 
// ganaría el index.html por defecto. Lo ponemos más abajo.

const TOKEN_RENIEC = process.env.TOKEN_RENIEC || 'sk_14781.y2AEO9v8Sx51hWfuNL0dVyDdK082pVsu';

// =====================================================
// 1. API RENIEC
// =====================================================
app.get('/api/dni/:numero', async (req, res) => {
    const { numero } = req.params;
    try {
        const response = await axios.get(
            `https://apiperu.dev/api/dni/${numero}`,
            {
                headers: {
                    'Authorization': `Bearer ${TOKEN_RENIEC}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        if (response.data.success) {
            res.json(response.data.data);
        } else {
            res.status(404).json({ success: false, message: 'DNI no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en la consulta' });
    }
});

// =====================================================
// 2. RUTAS DE USUARIOS Y PERSONAL
// =====================================================
app.put('/api/usuarios/actualizar', async (req, res) => {
    const { nombre, email, pass, foto, telf, dni } = req.body;
    try {
        const result = await pool.query(
            `UPDATE usuarios SET nombre = $1, password = $2, foto = $3, telefono = $4, dni = $5 WHERE correo = $6 RETURNING *`,
            [nombre, pass, foto || null, telf || null, dni || null, email]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT nombre, foto, telefono, dni FROM usuarios WHERE correo = $1 AND password = $2',
            [correo, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0].nombre, foto: result.rows[0].foto });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        }
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/personal', async (req, res) => {
    const { dni, nombres, telefono, id_cargo, pago_semanal, area } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO personal (dni, nombres_completos, telefono, id_cargo, pago_semanal_base, area) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [dni, nombres, telefono || null, id_cargo || 1, pago_semanal, area]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/personal', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM personal ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// =====================================================
// 3. ASISTENCIA
// =====================================================
app.post('/api/asistencia', async (req, res) => {
    const { id_personal, tipo } = req.body;
    try {
        if (tipo === 'entrada') {
            await pool.query(`INSERT INTO asistencia (id_personal, hora_entrada, fecha) VALUES ($1, NOW(), CURRENT_DATE)`, [id_personal]);
        } else {
            await pool.query(`UPDATE asistencia SET hora_salida = NOW() WHERE id_personal = $1 AND hora_salida IS NULL AND fecha = CURRENT_DATE`, [id_personal]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/asistencia', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.nombres_completos, p.area, a.hora_entrada, a.hora_salida, a.fecha
            FROM personal p
            LEFT JOIN asistencia a ON p.id = a.id_personal
            ORDER BY a.fecha DESC, a.hora_entrada DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// =====================================================
// RUTA FINAL PARA EL FRONTEND (CORREGIDO PARA PRIORIZAR LOGIN)
// =====================================================

// 1. Forzamos que la raíz mande a login.html
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// 2. Cargamos los archivos estáticos DESPUÉS de la ruta raíz
// para que no cargue el index.html por defecto
app.use(express.static(path.resolve(__dirname, '../frontend')));

// 3. Cualquier otra ruta no definida (como error 404) también manda al login
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en puerto: ${PORT}`);
});