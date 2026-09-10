require('dotenv').config();
const express = require('express');
const cors = require('cors');
const auditRoutes = require('./routes/audit.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'audit-service' }));
app.use('/', auditRoutes);

const PORT = process.env.PORT || 4009;
app.listen(PORT, () => console.log(`audit-service listening on port ${PORT}`));
