import ChatWindow from '../src/view/chat-window';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';

import {addFinalizer, gcUntil} from './util';

describe('ChatWindow', () => {
  afterEach(() => {
    serviceManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat', 'DummyCompletionChatService', endpoint);
      const chatWindow = new ChatWindow(instance);
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });
});
