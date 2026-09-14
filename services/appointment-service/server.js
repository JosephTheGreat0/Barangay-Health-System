require('dotenv').config();
const express = require('express');
const cors = require('cors');
const appointmentRoutes = require('./routes/appointment.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'appointment-service' }));
app.use('/', appointmentRoutes);

const PORT = process.env.PORT || 4005;
app.listen(PORT, () => console.log(`appointment-service listening on port ${PORT}`));
