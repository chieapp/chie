import {assert} from 'chai';

import MultiChatsService from '../src/model/multi-chats-service';
import apiManager from '../src/controller/api-manager';
import historyKeeper from '../src/controller/history-keeper';
import {ChatMessage, ChatCompletionAPI} from '../src/model/chat-api';
import {config} from '../src/controller/config-store';

describe('MultiChatsService', () => {
  let service: MultiChatsService;
  beforeEach(() => {
    config.inMemory = false;
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new MultiChatsService('Test', api);
  });
  afterEach(() => {
    service.clearChats();
    config.inMemory = true;
  });

  it('Serialize the moment of sub chat', async () => {
    const chat = service.createChat();
    await chat.sendMessage(new ChatMessage({content: 'Message'}));
    assert.deepEqual(service.serialize(), {
      name: 'Test',
      api: service.api.endpoint.id,
      chats: [ {moment: chat.moment} ],
    });
  });

  it('Recover from disk', async () => {
    const record = {
      title: 'Test from disk',
      history: [
        { role: 'Assistant', content: 'This is a' },
        { role: 'Assistant', content: 'test message.' },
      ],
    };
    const moment = historyKeeper.newMoment();
    await historyKeeper.save(moment, record);
    const data = {
      name: 'Test',
      api: service.api.endpoint.id,
      chats: [ {moment} ],
    };
    service = MultiChatsService.deserialize(data);
    await new Promise<void>((resolve) => service.chats[0].onLoad.connect(resolve));
    assert.equal(service.chats[0].title, record.title);
    assert.deepEqual(service.chats[0].history, record.history);
    assert.deepEqual(service.serialize(), data);
  });
});
