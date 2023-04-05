import gui from 'gui';

import MultiChatsView from '../src/view/multi-chats-view';
import {addFinalizer, gcUntil, createChatCompletionAPI} from './util';

describe('MultiChatsView', function() {
  this.timeout(10 * 1000);

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView('FreeTibet', createChatCompletionAPI());
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after adding and remove chats', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView('FreeTibet', createChatCompletionAPI());
      chatView.createChat();
      chatView.createChat();
      chatView.createChat();
      chatView.clearChats();
      chatView.createChat();
      chatView.createChat();
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
