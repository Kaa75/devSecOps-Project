'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME;

const s3Client = new S3Client({ region: REGION });

/**
 * Upload a PDF buffer to S3 and return a pre-signed URL.
 *
 * @param {string} orderId
 * @param {Buffer} pdfBuffer
 * @param {number} [expiresIn=3600]
 * @returns {Promise<string>} Pre-signed URL
 */
async function uploadInvoiceAndGetUrl(orderId, pdfBuffer, expiresIn = 3600) {
  const key = `invoices/${orderId}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );

  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );

  return url;
}

module.exports = { uploadInvoiceAndGetUrl };
