'use strict';

const mockBreaker = {
  fire: jest.fn(),
};

const mockPool = {
  query: jest.fn(),
};

module.exports = { breaker: mockBreaker, pool: mockPool };
