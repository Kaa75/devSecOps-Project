'use strict';

const AWSXRay = require('aws-xray-sdk');
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
AWSXRay.setDaemonAddress(process.env.AWS_XRAY_DAEMON_ADDRESS || 'xray-daemon:2000');

require('dotenv').config();

const express = require('express');
const productsRouter = require('./routes/products');

const app = express();
app.use(AWSXRay.express.openSegment('catalog'));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'catalog' }));
app.use('/products', productsRouter);

app.use(AWSXRay.express.closeSegment());

const PORT = process.env.PORT || 3000;
/* istanbul ignore next */
if (require.main === module) {
  app.listen(PORT, () => console.log(`catalog-service listening on :${PORT}`));
}

module.exports = app;
