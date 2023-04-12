import MultiChatsService from '../src/model/multi-chats-service';
import MultiChatsView from '../src/view/multi-chats-view';
import {addFinalizer, gcUntil} from './util';
import {createChatCompletionAPI} from '../test/util';

describe('MultiChatsView', function() {
  this.timeout(10 * 1000);

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView(new MultiChatsService('FreeTibet', createChatCompletionAPI()));
      chatView.initAsMainView();
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after adding and remove chats', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView(new MultiChatsService('FreeTibet', createChatCompletionAPI()));
      chatView.initAsMainView();
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
