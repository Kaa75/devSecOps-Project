'use strict';

const PDFDocument = require('pdfkit');

/**
 * Generate a PDF invoice buffer for the given order.
 *
 * @param {object} order
 * @param {string} order.orderId
 * @param {string} order.customerEmail
 * @param {Array<{productName: string, quantity: number, unitPrice: number}>} order.items
 * @param {number} order.totalAmount
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();

    // Order metadata
    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Customer Email: ${order.customerEmail}`);
    doc.moveDown();

    // Line items
    doc.fontSize(12).text('Items:', { underline: true });
    doc.moveDown(0.5);

    for (const item of order.items) {
      const lineTotal = (item.quantity * item.unitPrice).toFixed(2);
      doc.text(
        `  ${item.productName}  x${item.quantity}  @ $${Number(item.unitPrice).toFixed(2)}  =  $${lineTotal}`
      );
    }

    doc.moveDown();

    // Total
    doc.fontSize(13).text(`Total Amount: $${Number(order.totalAmount).toFixed(2)}`);

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
