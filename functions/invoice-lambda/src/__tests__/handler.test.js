'use strict';

const fc = require('fast-check');

jest.mock('../pdf');
jest.mock('../s3');
jest.mock('../ses');

const { generateInvoicePdf } = require('../pdf');
const { uploadInvoiceAndGetUrl } = require('../s3');
const { sendInvoiceEmail } = require('../ses');
const { handler } = require('../handler');

function makeSqsEvent(orders) {
  return {
    Records: orders.map((order) => ({ body: JSON.stringify(order) })),
  };
}

function makeOrder(overrides = {}) {
  return {
    orderId: 'order-123',
    customerEmail: 'customer@example.com',
    items: [{ productName: 'Widget A', quantity: 2, unitPrice: 19.99 }],
    totalAmount: 39.98,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  generateInvoicePdf.mockResolvedValue(Buffer.from('pdf-bytes'));
  uploadInvoiceAndGetUrl.mockResolvedValue('https://s3.example.com/invoices/order-123.pdf');
  sendInvoiceEmail.mockResolvedValue(undefined);
});

describe('handler — valid SQS event', () => {
  test('calls generateInvoicePdf, uploadInvoiceAndGetUrl, sendInvoiceEmail in order', async () => {
    const callOrder = [];
    generateInvoicePdf.mockImplementation(async () => { callOrder.push('pdf'); return Buffer.from('pdf-bytes'); });
    uploadInvoiceAndGetUrl.mockImplementation(async () => { callOrder.push('s3'); return 'https://s3.example.com/invoices/order-123.pdf'; });
    sendInvoiceEmail.mockImplementation(async () => { callOrder.push('ses'); });

    await handler(makeSqsEvent([makeOrder()]));

    expect(callOrder).toEqual(['pdf', 's3', 'ses']);
  });
});

describe('handler — failure propagation', () => {
  test('throws on PDF generation failure', async () => {
    generateInvoicePdf.mockRejectedValue(new Error('PDF failed'));
    await expect(handler(makeSqsEvent([makeOrder()]))).rejects.toThrow('PDF failed');
    expect(uploadInvoiceAndGetUrl).not.toHaveBeenCalled();
  });

  test('throws on S3 upload failure', async () => {
    uploadInvoiceAndGetUrl.mockRejectedValue(new Error('S3 failed'));
    await expect(handler(makeSqsEvent([makeOrder()]))).rejects.toThrow('S3 failed');
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  test('throws on SES failure', async () => {
    sendInvoiceEmail.mockRejectedValue(new Error('SES failed'));
    await expect(handler(makeSqsEvent([makeOrder()]))).rejects.toThrow('SES failed');
  });
});

describe('handler — multiple SQS records', () => {
  test('processes each record sequentially', async () => {
    const orders = [
      makeOrder({ orderId: 'order-A', customerEmail: 'a@example.com' }),
      makeOrder({ orderId: 'order-B', customerEmail: 'b@example.com' }),
    ];

    await handler(makeSqsEvent(orders));

    expect(generateInvoicePdf).toHaveBeenCalledTimes(2);
    expect(uploadInvoiceAndGetUrl).toHaveBeenCalledTimes(2);
    expect(sendInvoiceEmail).toHaveBeenCalledTimes(2);
  });
});

describe('Property 21: Invoice S3 key contains order ID', () => {
  test('uploadInvoiceAndGetUrl is called with the order ID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (orderId) => {
        jest.resetAllMocks();
        generateInvoicePdf.mockResolvedValue(Buffer.from('pdf'));
        sendInvoiceEmail.mockResolvedValue(undefined);
        let capturedId = null;
        uploadInvoiceAndGetUrl.mockImplementation(async (id) => {
          capturedId = id;
          return `https://s3.example.com/invoices/${id}.pdf`;
        });

        await handler(makeSqsEvent([makeOrder({ orderId })]));
        expect(capturedId).toBe(orderId);
      }),
      { numRuns: 50 }
    );
  });
});

describe('Property 22: Invoice email sent to correct recipient', () => {
  test('sendInvoiceEmail is called with the customer email from the order event', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), fc.uuid(), async (customerEmail, orderId) => {
        jest.resetAllMocks();
        generateInvoicePdf.mockResolvedValue(Buffer.from('pdf'));
        const invoiceUrl = `https://s3.example.com/invoices/${orderId}.pdf`;
        uploadInvoiceAndGetUrl.mockResolvedValue(invoiceUrl);
        sendInvoiceEmail.mockResolvedValue(undefined);

        await handler(makeSqsEvent([makeOrder({ orderId, customerEmail })]));
        expect(sendInvoiceEmail).toHaveBeenCalledWith(customerEmail, orderId, invoiceUrl);
      }),
      { numRuns: 50 }
    );
  });
});
