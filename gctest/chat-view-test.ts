import gui from 'gui';

import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import {addFinalizer, gcUntil, createChatCompletionAPI} from './util';

describe('ChatView', function() {
  this.timeout(10 * 1000);

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new ChatView();
      chatView.loadChatService(new ChatService('Xijinping', createChatCompletionAPI()));
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected inside window', async () => {
    let collected = false;
    (() => {
      const win = gui.Window.create({});
      const chatView = new ChatView();
      chatView.loadChatService(new ChatService('Xijinping', createChatCompletionAPI()));
      win.setContentView(chatView.view);
      addFinalizer(win, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
