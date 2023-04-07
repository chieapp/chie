import APIEndpoint from '../src/model/api-endpoint';
import ChatWindow from '../src/view/chat-window';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';

import {addFinalizer, gcUntil} from './util';

describe('ChatWindow', () => {
  afterEach(() => {
    apiManager.deserialize({});
    serviceManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    const endpoint = APIEndpoint.deserialize({
      name: 'Some API',
      type: 'DummyConversationAPI',
      url: '',
    });
    apiManager.addEndpoint(endpoint);

    let collected = false;
    (() => {
      const instance = serviceManager.createInstance('TestChat', 'DummyChat', endpoint);
      const chatWindow = new ChatWindow(instance);
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });
});
