import gui from 'gui';

export const mochaHooks = {
  beforeAll() {
    const {config} = require('../src/controller/config-store');
    config.inMemory = true;
  },
};
