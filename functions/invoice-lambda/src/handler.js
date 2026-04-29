'use strict';

const { generateInvoicePdf } = require('./pdf');
const { uploadInvoiceAndGetUrl } = require('./s3');
const { sendInvoiceEmail } = require('./ses');

/**
 * SQS event handler for invoice generation.
 *
 * Processing steps per record:
 *  1. Parse order event from SQS record body
 *  2. Generate PDF invoice (pdfkit)
 *  3. Upload PDF to S3 at key invoices/{orderId}.pdf
 *  4. Generate pre-signed URL for the uploaded PDF
 *  5. Send SES email to customer with the pre-signed URL
 *
 * Failure behaviour:
 *  - PDF generation failure  → throw (SQS retries via visibility timeout)
 *  - S3 upload failure       → throw (SQS retries via visibility timeout)
 *  - SES failure             → throw (SQS retries)
 *
 * @param {import('aws-lambda').SQSEvent} event
 */
async function handler(event) {
  for (const record of event.Records) {
    const order = JSON.parse(record.body);
    const { orderId, customerEmail, items, totalAmount } = order;

    console.log(`Processing order ${orderId} for ${customerEmail}`);

    // Steps 2-4: generate PDF, upload, get pre-signed URL
    // Errors propagate — SQS will retry the message
    const pdfBuffer = await generateInvoicePdf({ orderId, customerEmail, items, totalAmount });
    const invoiceUrl = await uploadInvoiceAndGetUrl(orderId, pdfBuffer);

    console.log(`Invoice uploaded for order ${orderId}`);

    // Step 5: send email
    await sendInvoiceEmail(customerEmail, orderId, invoiceUrl);

    console.log(`Invoice email sent for order ${orderId} to ${customerEmail}`);
  }
}

module.exports = { handler };
