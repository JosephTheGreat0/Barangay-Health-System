require('dotenv').config();
const express = require('express');
const cors = require('cors');
const referralRoutes = require('./routes/referral.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'referral-service' }));
app.use('/', referralRoutes);

const PORT = process.env.PORT || 4007;
app.listen(PORT, () => console.log(`referral-service listening on port ${PORT}`));
