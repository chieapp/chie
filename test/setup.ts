import APIEndpoint from '../src/model/api-endpoint';
import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import MultiChatsService from '../src/model/multi-chats-service';
import MultiChatsView from '../src/view/multi-chats-view';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
  ChatConversationAPI,
} from '../src/model/chat-api';

class DummyCompletionAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation(history, {onMessageDelta}) {
    onMessageDelta(
      new ChatMessage({role: ChatRole.Assistant, content: 'Reply'}),
      new ChatResponse({pending: false}));
  }
}

class DummyConversationAPI extends ChatConversationAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendMessage(text, {onMessageDelta}) {
    onMessageDelta(
      new ChatMessage({role: ChatRole.Assistant, content: 'Reply'}),
      new ChatResponse({pending: false}));
  }
  clear() {
    // Do nothing.
  }
}

export const mochaHooks = {
  beforeAll() {
    // Don't overwrite user's config when running tests.
    const {config, windowConfig} = require('../src/controller/config-store');
    config.inMemory = true;
    windowConfig.inMemory = true;

    // Register some APIs for testing.
    apiManager.registerAPI('DummyCompletionAPI', DummyCompletionAPI);
    apiManager.registerAPI('DummyConversationAPI', DummyConversationAPI);
    serviceManager.registerView(ChatView);
    serviceManager.registerView(MultiChatsView);
    serviceManager.registerService('DummyCompletionChatService', {
      serviceType: MultiChatsService,
      apiTypes: [ChatCompletionAPI],
      viewType: MultiChatsView,
    });
    serviceManager.registerService('DummyConversationChatService', {
      serviceType: ChatService,
      apiTypes: [ChatCompletionAPI, ChatConversationAPI],
      viewType: ChatView,
    });
    apiManager.addEndpoint(new APIEndpoint({
      name: 'API 1',
      type: 'DummyCompletionAPI',
      url: '',
    }));
    apiManager.addEndpoint(new APIEndpoint({
      name: 'API 2',
      type: 'DummyConversationAPI',
      url: '',
    }));
  },
};
