const express = require('express');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');

const app = express();

// =====================================================
// CONFIGURACIÓN DE MIDDLEWARES
// =====================================================
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// Tu Token de APIperu.dev / APIDNI
const TOKEN_RENIEC = 'sk_14781.y2AEO9v8Sx51hWfuNL0dVyDdK082pVsu';

// =====================================================
// 1. API RENIEC (Consulta de DNI mejorada)
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
            // Enviamos la data completa (nombres, apellido_paterno, apellido_materno, nombre_completo)
            res.json(response.data.data);
        } else {
            res.status(404).json({ success: false, message: 'DNI no encontrado en RENIEC' });
        }
    } catch (error) {
        console.error("Error Reniec:", error.message);
        res.status(500).json({ success: false, error: 'Error en la consulta externa a RENIEC' });
    }
});

// =====================================================
// 2. CONFIGURACIÓN DE PERFIL
// =====================================================
app.put('/api/usuarios/actualizar', async (req, res) => {
    const { nombre, email, pass, foto, telf, dni } = req.body;
    try {
        const result = await pool.query(
            `UPDATE usuarios 
             SET nombre = $1, password = $2, foto = $3, telefono = $4, dni = $5 
             WHERE correo = $6 RETURNING *`,
            [nombre, pass, foto || null, telf || null, dni || null, email]
        );

        if (result.rowCount > 0) {
            res.json({ 
                success: true, 
                message: "Perfil actualizado correctamente", 
                user: result.rows[0] 
            });
        } else {
            res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }
    } catch (err) {
        console.error("Error al actualizar perfil:", err.message);
        res.status(500).send("Error en el servidor: " + err.message);
    }
});

// =====================================================
// 3. LOGIN
// =====================================================
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT nombre, foto, telefono, dni FROM usuarios WHERE correo = $1 AND password = $2',
            [correo, password]
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                user: result.rows[0].nombre,
                foto: result.rows[0].foto,
                telefono: result.rows[0].telefono,
                dni: result.rows[0].dni
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Correo o contraseña incorrectos'
            });
        }
    } catch (err) {
        res.status(500).send("Error en el servidor: " + err.message);
    }
});

// =====================================================
// 4. REGISTRAR PERSONAL
// =====================================================
app.post('/api/personal', async (req, res) => {
    const { dni, nombres, telefono, id_cargo, pago_semanal, area } = req.body;

    if (!dni || !nombres || !pago_semanal) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO personal (dni, nombres_completos, telefono, id_cargo, pago_semanal_base, area)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [dni, nombres, telefono || null, id_cargo || 1, pago_semanal, area]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error BD:", err.message);
        res.status(500).send("Error al insertar: " + err.message);
    }
});

// =====================================================
// 5. OBTENER TODO EL PERSONAL
// =====================================================
app.get('/api/personal', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM personal ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// =====================================================
// 6. ELIMINAR PERSONAL
// =====================================================
app.delete('/api/personal/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM personal WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "No encontrado" });
        res.json({ success: true, message: 'Eliminado' });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// =====================================================
// 7. ASISTENCIA
// =====================================================
app.post('/api/asistencia', async (req, res) => {
    const { id_personal, tipo } = req.body;
    try {
        if (tipo === 'entrada') {
            await pool.query(
                `INSERT INTO asistencia (id_personal, hora_entrada, fecha) VALUES ($1, NOW(), CURRENT_DATE)`,
                [id_personal]
            );
        } else {
            await pool.query(
                `UPDATE asistencia SET hora_salida = NOW() 
                 WHERE id_personal = $1 AND hora_salida IS NULL AND fecha = CURRENT_DATE`,
                [id_personal]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// =====================================================
// 8. LISTAR ASISTENCIAS
// =====================================================
app.get('/api/asistencia', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.nombres_completos, p.area, a.hora_entrada, a.hora_salida, a.fecha
            FROM personal p
            LEFT JOIN asistencia a ON p.id = a.id_personal
            ORDER BY a.fecha DESC, a.hora_entrada DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Iniciar Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});