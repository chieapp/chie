import gui from 'gui';

import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import {addFinalizer, gcUntil} from './util';
import {createChatCompletionAPI} from '../test/util';

describe('ChatView', () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new ChatView(new ChatService('Xijinping', createChatCompletionAPI()));
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
      const chatView = new ChatView(new ChatService('Xijinping', createChatCompletionAPI()));
      win.setContentView(chatView.view);
      chatView.initAsMainView();
      addFinalizer(win, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
