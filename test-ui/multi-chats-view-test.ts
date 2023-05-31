import {assert} from 'chai';

import ChatListItem from '../src/view/chat-list-item';
import MultiChatsService from '../src/model/multi-chats-service';
import MultiChatsView from '../src/view/multi-chats-view';
import apiManager from '../src/controller/api-manager';
import {ChatRole, ChatCompletionAPI} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';

describe('MultiChatsView', function() {
  let service: MultiChatsService;
  beforeEach(() => {
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new MultiChatsService({name: 'Test', api});
  });
  afterEach(() => {
    service.destructor();
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView();
      chatView.loadService(service);
      addFinalizer(chatView, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const chatView = new MultiChatsView();
      chatView.loadService(service);
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
      const chatView = new MultiChatsView();
      chatView.loadService(service);
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

  it('item can be garbage collected', async () => {
    let collected = false;
    (() => {
      const chat = service.createChat();
      const item = new ChatListItem(chat);
      service.removeChatAt(0);
      addFinalizer(item, () => collected = true);
      item.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('does not reference removed chat', async () => {
    let collected = false;
    (() => {
      const chatView = new MultiChatsView();
      chatView.loadService(service);
      const chat = service.createChat();
      assert.equal(chat, service.chats[0]);
      service.removeChatAt(0);
      addFinalizer(chat, () => collected = true);
      chatView.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('does not have multiple selected views after creating chat', async () => {
    const chatView = new MultiChatsView();
    await chatView.loadService(service);
    service.createChat();
    service.createChat();
    assert.isTrue(chatView.items[0].selected);
    assert.isFalse(chatView.items[1].selected);
  });

  it('selects sibling view after removing chat', async () => {
    const chatView = new MultiChatsView();
    await chatView.loadService(service);
    service.createChat();
    service.createChat();
    service.createChat();
    service.removeChatAt(0);
    assert.isTrue(chatView.items[0].selected);
    service.removeChatAt(0);
    assert.isTrue(chatView.items[0].selected);
  });
});
