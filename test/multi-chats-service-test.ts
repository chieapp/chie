import {assert} from 'chai';

import MultiChatsService from '../src/model/multi-chats-service';
import apiManager from '../src/controller/api-manager';
import historyKeeper from '../src/controller/history-keeper';
import {ChatCompletionAPI} from '../src/model/chat-api';
import {config} from '../src/controller/configs';

describe('MultiChatsService', () => {
  let service: MultiChatsService;
  beforeEach(() => {
    config.inMemory = false;
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new MultiChatsService({name: 'Test', api});
  });
  afterEach(() => {
    service.destructor();
    config.inMemory = true;
  });

  it('Serialize the moment of sub chat', async () => {
    const chat = service.createChat();
    await chat.sendMessage({content: 'Message'});
    assert.deepEqual(service.serialize(), {
      name: 'Test',
      api: service.api.endpoint.id,
      icon: 'chie://app-file/assets/icons/bot.png',
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
    await historyKeeper.flush();
    const data = {
      name: 'Test',
      api: service.api.endpoint.id,
      icon: 'chie://app-file/assets/icons/bot.png',
      chats: [ {moment} ],
    };
    service = new MultiChatsService(MultiChatsService.deserialize(data));
    await new Promise<void>((resolve) => service.chats[0].onLoad.connect(resolve));
    assert.equal(service.chats[0].getTitle(), record.title);
    assert.deepEqual(service.chats[0].getHistory(), record.history);
    assert.deepEqual(service.serialize(), data);
  });
});
