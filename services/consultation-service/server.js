require('dotenv').config();
const express = require('express');
const cors = require('cors');
const consultationRoutes = require('./routes/consultation.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'consultation-service' }));
app.use('/', consultationRoutes);

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`consultation-service listening on port ${PORT}`));
