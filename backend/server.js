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
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Token de APIperu.dev para consultas de DNI
const TOKEN_RENIEC = process.env.TOKEN_RENIEC;

// =====================================================
// 1. ENDPOINT DE AUTENTICACIÓN (LOGIN)
// =====================================================
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, nombre, correo, foto_url FROM usuarios WHERE correo = $1 AND password = $2', 
            [correo, password]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({
                success: true,
                user: user.nombre,
                foto: user.foto_url || 'https://i.imgur.com/8Km9tLL.png',
                message: 'Login exitoso'
            });
        } else {
            res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
        }
    } catch (error) {
        console.error("❌ Error en Login:", error.message);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// =====================================================
// 2. CONSULTA API RENIEC
// =====================================================
app.get('/api/dni/:numero', async (req, res) => {
    const { numero } = req.params;
    try {
        const response = await axios.get(`https://apiperu.dev/api/dni/${numero}`, {
            headers: {
                'Authorization': `Bearer ${TOKEN_RENIEC}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.data.success) {
            res.json(response.data.data);
        } else {
            res.status(404).json({ success: false, message: 'DNI no encontrado en RENIEC' });
        }
    } catch (error) {
        console.error("❌ Error RENIEC:", error.message);
        res.status(500).json({ success: false, error: 'Error al consultar el DNI' });
    }
});

// =====================================================
// 3. API CONTROL DE TRABAJADORES Y PLANILLA (CRUD + BD)
// =====================================================

// Obtener todos los trabajadores con sus horas acumuladas calculadas
app.get('/api/trabajadores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trabajadores ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error al traer trabajadores:", error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// Registrar o Editar Trabajador
app.post('/api/trabajadores', async (req, res) => {
    const { id, nombre, dni, telf, area, sueldoBase } = req.body;
    try {
        if (id) {
            // Modo Edición
            await pool.query(
                'UPDATE trabajadores SET nombre = $1, dni = $2, telf = $3, area = $4, sueldo_base = $5 WHERE id = $6',
                [nombre.toUpperCase(), dni, telf, area, sueldoBase, id]
            );
            res.json({ success: true, message: 'Trabajador actualizado' });
        } else {
            // Modo Nuevo Registro
            await pool.query(
                'INSERT INTO trabajadores (nombre, dni, telf, area, sueldo_base, horas_acumuladas) VALUES ($1, $2, $3, $4, $5, 0)',
                [nombre.toUpperCase(), dni, telf, area, sueldoBase]
            );
            res.json({ success: true, message: 'Trabajador registrado con éxito' });
        }
    } catch (error) {
        console.error("❌ Error al guardar trabajador:", error.message);
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

// Eliminar / Despedir Trabajador
app.delete('/api/trabajadores/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM trabajadores WHERE id = $1', [id]);
        res.json({ success: true, message: 'Trabajador eliminado' });
    } catch (error) {
        console.error("❌ Error al eliminar:", error.message);
        res.status(500).json({ success: false, message: 'Error al eliminar de la base de datos' });
    }
});

// Procesar Pago Semanal (Maneja la transacción lógica del dinero)
app.post('/api/trabajadores/pagar', async (req, res) => {
    const { id, monto } = req.body;
    try {
        // Iniciamos una transacción SQL para asegurar consistencia
        await pool.query('BEGIN');

        // 1. Limpiamos las horas acumuladas del trabajador tras el cobro exitoso
        await pool.query(
            'UPDATE trabajadores SET horas_acumuladas = 0 WHERE id = $1',
            [id]
        );

        // 2. Aquí podrías registrar el movimiento en una tabla "historial_pagos" si lo deseas

        await pool.query('COMMIT');
        res.json({ success: true, message: 'Pago procesado en base de datos' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("❌ Error al procesar pago en BD:", error.message);
        res.status(500).json({ success: false, message: 'Error al liquidar el pago' });
    }
});

// =====================================================
// 4. CONFIGURACIÓN DE FRONTEND Y RUTAS DE CONTROL
// =====================================================

// Servir archivos estáticos del frontend (HTML, CSS, JS)
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Ruta por defecto: Login
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// Servir la interfaz del Dashboard principal
app.get('/dashboard', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

// Servir la interfaz de Asistencia
app.get('/asistencia', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'asistencia.html'));
});

// Captura cualquier otra ruta no definida (Evita el error 'Cannot GET')
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// =====================================================
// LEVANTAMIENTO DEL ENTORNO
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo de forma óptima en el puerto: ${PORT}`);
});