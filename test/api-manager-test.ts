import {assert} from 'chai';

import APICredential from '../src/model/api-credential';
import {APIManager} from '../src/controller/api-manager';

describe('APIManager', () => {
  const apiConfig = {name: 'Tiananmen', type: 'ChatGPT', url: '', key: ''};

  it('deserializes from config', () => {
    const apiManager = new APIManager();
    apiManager.deserialize({'tiananmen-8964': apiConfig});
    assert.notEqual(apiManager.getCredentialById('tiananmen-8964'), null);
  });

  it('generates id increasingly', () => {
    const apiManager = new APIManager();
    const id1 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id1, 'tiananmen-1');
    const id2 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id2, 'tiananmen-2');
    const id3 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id3, 'tiananmen-3');
    apiManager.removeCredentialById(id1);
    apiManager.removeCredentialById(id2);
    const id4 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id4, 'tiananmen-4');
  });

  it('handles invalid id', () => {
    const apiManager = new APIManager();
    apiManager.deserialize({'tiananmen-invalid': apiConfig});
    const id1 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id1, 'tiananmen-1');
    const id2 = apiManager.addCredential(APICredential.deserialize(apiConfig));
    assert.equal(id2, 'tiananmen-2');
  });
});
