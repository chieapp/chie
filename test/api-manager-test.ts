import {assert} from 'chai';

import APIEndpoint from '../src/model/api-endpoint';
import apiManager from '../src/controller/api-manager';

describe('APIManager', () => {
  const apiConfig = {name: 'Tiananmen', type: 'ChatGPT', url: '', key: ''};

  afterEach(() => {
    const {config} = require('../src/controller/config-store');
    config.deserialize({});
  });

  it('deserializes from config', () => {
    const {config} = require('../src/controller/config-store');
    config.deserialize({apis: {'tiananmen-8964': apiConfig}});
    assert.notEqual(apiManager.getEndpointById('tiananmen-8964'), null);
  });

  it('generates id increasingly', () => {
    const id1 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id1, 'tiananmen-1');
    const id2 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id2, 'tiananmen-2');
    const id3 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id3, 'tiananmen-3');
    apiManager.removeEndpoint(id1);
    apiManager.removeEndpoint(id2);
    const id4 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id4, 'tiananmen-4');
  });

  it('handles invalid id', () => {
    const {config} = require('../src/controller/config-store');
    config.deserialize({apis: {'tiananmen-invalid': apiConfig}});
    const id1 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id1, 'tiananmen-1');
    const id2 = apiManager.addEndpoint(new APIEndpoint(apiConfig));
    assert.equal(id2, 'tiananmen-2');
  });
});
