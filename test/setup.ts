import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import {ChatCompletionAPI, ChatConversationAPI} from '../src/model/chat-api';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';

class DummyCompletionAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation() {
    // Do nothing.
  }
}

class DummyConversationAPI extends ChatConversationAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendMessage() {
    // Do nothing.
  }
  clear() {
    // Do nothing.
  }
}

export const mochaHooks = {
  beforeAll() {
    // Don't overwrite user's config when running tests.
    const {config} = require('../src/controller/config-store');
    config.inMemory = true;

    // Register some APIs for testing.
    apiManager.registerAPI('DummyCompletionAPI', DummyCompletionAPI);
    apiManager.registerAPI('DummyConversationAPI', DummyConversationAPI);
    serviceManager.registerView(ChatView);
    serviceManager.registerService('DummyChat', {
      serviceType: ChatService,
      apiTypes: [ChatConversationAPI],
      viewType: ChatView,
    });
  },
};
