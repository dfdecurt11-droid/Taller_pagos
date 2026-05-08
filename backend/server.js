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

// Token de APIperu.dev
const TOKEN_RENIEC = process.env.TOKEN_RENIEC;

// =====================================================
// 1. API LOGIN (FALTABA EN TU CÓDIGO)
// =====================================================
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        // Consultamos a la base de datos (ajusta los nombres de columnas según tu DB)
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE correo = $1 AND password = $2', 
            [correo, password]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({
                success: true,
                user: user.nombre, // O el campo que uses para el nombre
                foto: user.foto_url || 'https://via.placeholder.com/100',
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
// 2. API RENIEC
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
            res.status(404).json({ success: false, message: 'DNI no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en la consulta' });
    }
});

// =====================================================
// 3. CONFIGURACIÓN DE FRONTEND (ORDEN IMPORTANTE)
// =====================================================

// Primero: Servir archivos estáticos (CSS, JS, Imágenes)
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Segundo: Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// Tercero: Manejo de rutas para SPA (Cualquier otra ruta redirige al login o index)
// Nota: Solo se activará si NO coincide con ninguna de las rutas de API de arriba
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

// =====================================================
// INICIO DEL SERVIDOR
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en puerto: ${PORT}`);
});