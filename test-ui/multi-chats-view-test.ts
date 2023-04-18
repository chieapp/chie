import {assert} from 'chai';

import MultiChatsService from '../src/model/multi-chats-service';
import MultiChatsView from '../src/view/multi-chats-view';
import {ChatRole} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';
import {createChatCompletionAPI} from '../test/util';

describe('MultiChatsView', function() {
  this.timeout(10 * 1000);

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView(new MultiChatsService('chat', createChatCompletionAPI()));
      chatView.initAsMainView();
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const service = new MultiChatsService('chat', createChatCompletionAPI());
      const chatView = new MultiChatsView(service);
      chatView.initAsMainView();
      const chat = service.createChat();
      await chat.sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after adding and remove chats', async () => {
    let collected = false;
    (() => {
      const service = new MultiChatsService('chat', createChatCompletionAPI());
      const chatView = new MultiChatsView(service);
      chatView.initAsMainView();
      service.createChat();
      service.createChat();
      service.createChat();
      service.clearChats();
      service.createChat();
      service.createChat();
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('chat can be garbage collected after removed', async () => {
    let collected = false;
    (() => {
      const service = new MultiChatsService('chat', createChatCompletionAPI());
      const chatView = new MultiChatsView(service);
      chatView.initAsMainView();
      const chat = service.createChat();
      assert.equal(chat, service.chats[0]);
      service.removeChatAt(0);
      addFinalizer(chat, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });
});
