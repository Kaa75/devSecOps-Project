'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const REGION = process.env.AWS_REGION || 'us-east-1';
const FROM_EMAIL = process.env.SES_FROM_EMAIL;

const sesClient = new SESClient({ region: REGION });

/**
 * Send an invoice email to the customer via SES.
 *
 * @param {string} toEmail
 * @param {string} orderId
 * @param {string} invoiceUrl
 * @returns {Promise<void>}
 */
async function sendInvoiceEmail(toEmail, orderId, invoiceUrl) {
  await sesClient.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: {
          Data: `Your ShopCloud Invoice — Order ${orderId}`,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: [
              `Thank you for your order!`,
              ``,
              `Order ID: ${orderId}`,
              ``,
              `Download your invoice (link valid for 1 hour):`,
              invoiceUrl,
            ].join('\n'),
            Charset: 'UTF-8',
          },
        },
      },
    })
  );
}

module.exports = { sendInvoiceEmail };
