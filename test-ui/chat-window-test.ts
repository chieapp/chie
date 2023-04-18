import ChatService from '../src/model/chat-service';
import ChatWindow from '../src/view/chat-window';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
import {ChatRole} from '../src/model/chat-api';

import {addFinalizer, gcUntil} from './util';

describe('ChatWindow', () => {
  afterEach(() => {
    serviceManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat', 'DummyConversationChatService', endpoint);
      const chatWindow = new ChatWindow(instance);
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat', 'DummyConversationChatService', endpoint);
      const chatWindow = new ChatWindow(instance);
      await (instance.service as ChatService).sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });
});
