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
  const requiredEnvVars = [
    'COGNITO_CUSTOMER_POOL_ID',
    'COGNITO_CUSTOMER_CLIENT_ID',
    'COGNITO_ADMIN_POOL_ID',
    'COGNITO_ADMIN_CLIENT_ID',
  ];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error('FATAL: missing required env vars:', missing.join(', '));
    process.exit(1);
  }
  const set = requiredEnvVars.filter((v) => process.env[v]);
  console.log('Cognito env vars present:', set.join(', '));

  app.listen(PORT, () => console.log(`auth-service listening on :${PORT}`));
}

module.exports = app;
