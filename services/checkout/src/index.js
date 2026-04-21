'use strict';

const AWSXRay = require('aws-xray-sdk');
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
AWSXRay.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || 'xray-daemon:2000');

require('dotenv').config();

const express = require('express');
const checkoutRoutes = require('./routes/checkout');

const app = express();
app.use(AWSXRay.express.openSegment('checkout'));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'checkout' }));

app.use('/', checkoutRoutes);

app.use(AWSXRay.express.closeSegment());

const PORT = process.env.PORT || 3002;

/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => console.log(`checkout-service listening on :${PORT}`));
}

module.exports = app;
