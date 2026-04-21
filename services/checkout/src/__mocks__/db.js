'use strict';

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

const withTransaction = jest.fn();

module.exports = { pool: mockPool, withTransaction };
