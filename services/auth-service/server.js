require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`auth-service listening on port ${PORT}`));
