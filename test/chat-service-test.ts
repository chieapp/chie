import {assert} from 'chai';

import ChatService from '../src/model/chat-service';
import apiManager from '../src/controller/api-manager';
import historyKeeper from '../src/controller/history-keeper';
import {ChatCompletionAPI} from '../src/model/chat-api';
import {config} from '../src/controller/configs';

describe('ChatService', () => {
  let service: ChatService;
  beforeEach(() => {
    config.inMemory = false;
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new ChatService({name: 'Test', api});
  });
  afterEach(() => {
    service.destructor();
    config.inMemory = true;
  });

  it('Write history to disk', async () => {
    service.setCustomTitle('Test Conversation');
    await service.sendMessage({content: 'Message'});
    assert.isString(service.moment);
    await historyKeeper.flush();
    assert.deepEqual(await historyKeeper.remember(service.moment), {
      customTitle: service.getTitle(),
      history: [
        { role: 'User', content: 'Message' },
        { role: 'Assistant', content: 'Reply' },
      ],
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
    assert.deepEqual(record, await historyKeeper.remember(moment));
    service = new ChatService({name: 'Test', api: service.api, moment});
    await service.load();
    assert.equal(record.title, service.getTitle());
    assert.deepEqual(record.history, service.history);
  });
});
