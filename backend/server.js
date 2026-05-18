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
// 1. CONSULTA API RENIEC
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
// 2. API CONTROL DE TRABAJADORES Y PLANILLA (CRUD + BD)
// =====================================================

// Obtener todos los trabajadores mapeando snake_case a camelCase para compatibilidad
app.get('/api/trabajadores', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nombre, dni, telf, area, sueldo_base AS "sueldoBase", horas_acumuladas AS "horasAcumuladas", hora_entrada_temp AS "horaEntradaTemp", hora_salida_temp AS "horaSalidaTemp", monto_a_pagar AS "montoAPagar", historial FROM trabajadores ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error al traer trabajadores:", error.message);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// Registrar Nuevo Trabajador (Únicamente POST para inserción limpia)
app.post('/api/trabajadores', async (req, res) => {
    const { nombre, dni, telf, area, sueldoBase } = req.body;
    try {
        await pool.query(
            'INSERT INTO trabajadores (nombre, dni, telf, area, sueldo_base, horas_acumuladas, monto_a_pagar, historial) VALUES ($1, $2, $3, $4, $5, 0, 0, \'[]\')',
            [nombre.toUpperCase(), dni, telf, area, sueldoBase]
        );
        res.json({ success: true, message: 'Trabajador registrado con éxito' });
    } catch (error) {
        console.error("❌ Error al guardar trabajador:", error.message);
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

// Actualizar perfil o guardar marcaciones de asistencia (PUT)
app.put('/api/trabajadores/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, dni, telf, area, sueldoBase, horasAcumuladas, horaEntradaTemp, horaSalidaTemp, montoAPagar, historial } = req.body;

    try {
        // Validamos si viene una actualización completa de asistencia o solo edición de formulario básico
        if (horaEntradaTemp !== undefined || horaSalidaTemp !== undefined || horasAcumuladas !== undefined) {
            // Flujo de marcación de asistencia desde asistencia.html
            await pool.query(
                `UPDATE trabajadores 
                 SET hora_entrada_temp = $1, 
                     hora_salida_temp = $2, 
                     horas_acumuladas = $3, 
                     monto_a_pagar = $4,
                     historial = $5
                 WHERE id = $6`,
                [horaEntradaTemp, horaSalidaTemp, horasAcumuladas, montoAPagar, JSON.stringify(historial || []), id]
            );
            return res.json({ success: true, message: 'Marcación de asistencia guardada' });
        } else {
            // Flujo normal de edición de datos administrativos
            await pool.query(
                `UPDATE trabajadores 
                 SET nombre = $1, dni = $2, telf = $3, area = $4, sueldo_base = $5 
                 WHERE id = $6`,
                [nombre.toUpperCase(), dni, telf, area, sueldoBase, id]
            );
            return res.json({ success: true, message: 'Datos del trabajador actualizados' });
        }
    } catch (error) {
        console.error("❌ Error en PUT trabajadores:", error.message);
        res.status(500).json({ success: false, message: 'Error al actualizar registro en base de datos' });
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

// Procesar Pago Semanal y Reiniciar métricas
app.post('/api/trabajadores/pagar', async (req, res) => {
    const { id } = req.body;
    try {
        await pool.query('BEGIN');

        // Limpiamos tanto las horas acumuladas como el monto pendiente tras cobrar con éxito
        await pool.query(
            'UPDATE trabajadores SET horas_acumuladas = 0, monto_a_pagar = 0, hora_entrada_temp = NULL, hora_salida_temp = NULL WHERE id = $1',
            [id]
        );

        await pool.query('COMMIT');
        res.json({ success: true, message: 'Pago procesado y horas reiniciadas' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("❌ Error al procesar pago en BD:", error.message);
        res.status(500).json({ success: false, message: 'Error al liquidar el pago' });
    }
});

// =====================================================
// 3. CONFIGURACIÓN DE FRONTEND Y RUTAS DE CONTROL DIRECTO
// =====================================================
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Redirección directa al Dashboard principal sin pasar por login
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/asistencia', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'asistencia.html'));
});

// Captura cualquier otra ruta no definida mandándola al Dashboard
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

// =====================================================
// LEVANTAMIENTO DEL ENTORNO
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo de forma óptima en el puerto: ${PORT}`);
});