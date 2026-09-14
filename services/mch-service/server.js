require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mchRoutes = require('./routes/mch.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'mch-service' }));
app.use('/', mchRoutes);

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => console.log(`mch-service listening on port ${PORT}`));
