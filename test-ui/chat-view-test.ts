import gui from 'gui';

import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import {ChatRole} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';
import {createChatCompletionAPI} from '../test/util';

describe('ChatView', () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new ChatView(new ChatService({name: 'chat', api: createChatCompletionAPI()}));
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
      const chatView = new ChatView(new ChatService({name: 'chat', api: createChatCompletionAPI()}));
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
      const chatView = new ChatView(new ChatService({name: 'chat', api: createChatCompletionAPI()}));
      chatView.initAsMainView();
      await chatView.service.sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
