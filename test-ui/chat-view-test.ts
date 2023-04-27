import gui from 'gui';

import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import apiManager from '../src/controller/api-manager';
import {ChatRole, ChatCompletionAPI} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';

describe('ChatView', () => {
  let service: ChatService;
  beforeEach(() => {
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new ChatService({name: 'Test', api});
  });
  afterEach(() => {
    service.destructor();
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new ChatView(service);
      chatView.initAsMainView();
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected inside window', async () => {
    let collected = false;
    (() => {
      const win = gui.Window.create({});
      const chatView = new ChatView(service);
      win.setContentView(chatView.view);
      chatView.initAsMainView();
      addFinalizer(win, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const chatView = new ChatView(service);
      chatView.initAsMainView();
      await chatView.service.sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
