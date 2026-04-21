'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const client = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const QUEUE_URL = process.env.SQS_QUEUE_URL;

/**
 * Publish an order event to the SQS invoice queue.
 * @param {object} orderEvent - The order event matching the SQS message schema.
 */
async function publishOrderEvent(orderEvent) {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(orderEvent),
  });
  return client.send(command);
}

module.exports = { publishOrderEvent };
