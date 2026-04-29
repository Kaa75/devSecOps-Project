'use strict';

const AWSXRay = require('aws-xray-sdk');
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
AWSXRay.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || 'xray-daemon:2000');

require('dotenv').config();

const express = require('express');
const authRoutes = require('./routes/auth');

const app = express();
app.use(AWSXRay.express.openSegment('auth'));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth' }));
app.use('/auth', authRoutes);

app.use(AWSXRay.express.closeSegment());

const PORT = process.env.PORT || 3003;

/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => console.log(`auth-service listening on :${PORT}`));
}

module.exports = app;
