import {assert} from 'chai';

import ChatService from '../src/model/chat-service';
import apiManager from '../src/controller/api-manager';
import historyKeeper from '../src/controller/history-keeper';
import {ChatMessage, ChatCompletionAPI} from '../src/model/chat-api';
import {config} from '../src/controller/config-store';

describe('ChatService', () => {
  let service: ChatService;
  beforeEach(() => {
    config.inMemory = false;
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const api = apiManager.createAPIForEndpoint(endpoint) as ChatCompletionAPI;
    service = new ChatService('Test', api);
  });
  afterEach(() => {
    service.remove();
    config.inMemory = true;
  });

  it('Write history to disk', async () => {
    service.title = 'Test Conversation';
    await service.sendMessage(new ChatMessage({content: 'Message'}));
    assert.isString(service.moment);
    assert.deepEqual(historyKeeper.remember(service.moment), {
      title: service.title,
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
    assert.deepEqual(record, historyKeeper.remember(moment));
    service = new ChatService('Test', service.api, {moment});
    assert.equal(record.title, service.title);
    assert.deepEqual(record.history, service.history);
  });
});
