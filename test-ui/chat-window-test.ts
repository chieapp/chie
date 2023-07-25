import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import ChatWindow from '../src/view/chat-window';
import apiManager from '../src/controller/api-manager';
import assistantManager from '../src/controller/assistant-manager';
import {ChatRole} from '../src/model/chat-api';

import {addFinalizer, gcUntil} from './util';

describe('ChatWindow', () => {
  afterEach(() => {
    assistantManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const credential = apiManager.getCredentialsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat', 'ChatService', credential, ChatView);
      const chatWindow = new ChatWindow(assistant);
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const credential = apiManager.getCredentialsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat', 'ChatService', credential, ChatView);
      const chatWindow = new ChatWindow(assistant);
      await (assistant.service as ChatService).sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(chatWindow, () => collected = true);
      chatWindow.window.close();
    })();
    await gcUntil(() => collected);
  });
});
