// backend/server.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Token de APIperu.dev desde variables de entorno
const TOKEN_RENIEC = process.env.TOKEN_RENIEC;

// =====================================================
// 1. API RENIEC
// =====================================================
app.get('/api/dni/:numero', async (req, res) => {
  const { numero } = req.params;
  try {
    const response = await axios.get(`https://apiperu.dev/api/dni/${numero}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN_RENIEC}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
// 2. RUTAS DE USUARIOS / LOGIN / PERSONAL / ASISTENCIA
// (Tu código original aquí, sin cambios mayores)
// =====================================================

// =====================================================
// 3. FRONTEND
// =====================================================
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'frontend', 'login.html'));
});

app.use(express.static(path.resolve(__dirname, '../frontend')));

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
