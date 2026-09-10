require('dotenv').config();
const express = require('express');
const cors = require('cors');
const reportingRoutes = require('./routes/reporting.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'reporting-service' }));
app.use('/', reportingRoutes);

const PORT = process.env.PORT || 4008;
app.listen(PORT, () => console.log(`reporting-service listening on port ${PORT}`));
