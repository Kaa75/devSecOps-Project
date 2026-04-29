'use strict';

const breaker = {
  fire: jest.fn(),
  opened: false,
};

module.exports = { breaker };
