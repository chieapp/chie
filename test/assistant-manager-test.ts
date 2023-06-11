import {assert} from 'chai';

import APIEndpoint from '../src/model/api-endpoint';
import ChatView from '../src/view/chat-view';
import ChatService from '../src/model/chat-service';
import apiManager from '../src/controller/api-manager';
import {AssistantManager} from '../src/controller/assistant-manager';

describe('AssistantManager', () => {
  let assistantManager: AssistantManager;

  beforeEach(() => {
    assistantManager = new AssistantManager();
  });

  it('createAssistant checks API compatibility', () => {
    const endpoint = APIEndpoint.deserialize({
      name: 'Some API',
      type: 'DummyConversationAPI',
      url: '',
    });
    assert.throws(
      () => assistantManager.createAssistant('TestChat', 'MultiChatsService', endpoint, ChatView),
      'Service "MultiChatsService" does not support API type "DummyConversationAPI".');
  });

  it('serialize and restore assistants', () => {
    const endpoint = apiManager.getEndpointsByType('DummyConversationAPI')[0];
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', endpoint, ChatView);
    assert.equal(assistant, assistantManager.getAssistants()[0]);
    // Force a re-initialization by deserializing from serialized data.
    assistantManager.deserialize(assistantManager.serialize());
    // The assistants are no longer the same object.
    assert.notEqual(assistant, assistantManager.getAssistants()[0]);
    // But they still have same members.
    delete (assistant.service as ChatService).id;
    delete (assistantManager.getAssistants()[0].service as ChatService).id;
    assert.deepEqual(assistant, assistantManager.getAssistants()[0]);
  });
});