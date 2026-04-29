'use strict';

const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

const region = process.env.AWS_REGION || 'us-east-1';

let _client = null;

function getCognitoClient() {
  if (!_client) {
    _client = new CognitoIdentityProviderClient({ region });
  }
  return _client;
}

const pools = {
  customer: {
    userPoolId: process.env.COGNITO_CUSTOMER_POOL_ID,
    clientId: process.env.COGNITO_CUSTOMER_CLIENT_ID,
  },
  admin: {
    userPoolId: process.env.COGNITO_ADMIN_POOL_ID,
    clientId: process.env.COGNITO_ADMIN_CLIENT_ID,
  },
};

module.exports = { getCognitoClient, pools };
