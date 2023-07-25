import APICredential from '../src/model/api-credential';
import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import MultiChatsService from '../src/model/multi-chats-service';
import MultiChatsView from '../src/view/multi-chats-view';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
import windowManager from '../src/controller/window-manager';
import {
  ChatRole,
  ChatCompletionAPI,
  ChatConversationAPI,
} from '../src/model/chat-api';

class DummyCompletionAPI extends ChatCompletionAPI {
  constructor(credential) {
    super(credential);
  }
  async sendConversation(history, {onMessageDelta}) {
    onMessageDelta({role: ChatRole.Assistant, content: 'Reply'}, {pending: false});
  }
}

class DummyConversationAPI extends ChatConversationAPI {
  constructor(credential) {
    super(credential);
  }
  async sendMessage(text, {onMessageDelta}) {
    onMessageDelta({role: ChatRole.Assistant, content: 'Reply'}, {pending: false});
  }
  clear() {
    // Do nothing.
  }
}

export const mochaHooks = {
  beforeAll() {
    // Don't overwrite user's config when running tests.
    const {config, windowConfig} = require('../src/controller/configs');
    config.inMemory = true;
    windowConfig.inMemory = true;

    // Don't quit when windows are closed.
    windowManager.quitOnAllWindowsClosed = false;

    // Register some APIs for testing.
    apiManager.registerAPI({
      name: 'DummyCompletionAPI',
      apiClass: DummyCompletionAPI,
      auth: 'none',
    });
    apiManager.registerAPI({
      name: 'DummyConversationAPI',
      apiClass: DummyConversationAPI,
      auth: 'none',
    });
    serviceManager.registerView(ChatView);
    serviceManager.registerView(MultiChatsView);
    serviceManager.registerService({
      serviceClass: MultiChatsService,
      apiClasses: [ChatCompletionAPI],
      viewClasses: [ChatView, MultiChatsView],
    });
    serviceManager.registerService({
      serviceClass: ChatService,
      apiClasses: [ChatCompletionAPI, ChatConversationAPI],
      viewClasses: [ChatView],
    });
    apiManager.addCredential(new APICredential({
      name: 'API 1',
      type: 'DummyCompletionAPI',
    }));
    apiManager.addCredential(new APICredential({
      name: 'API 2',
      type: 'DummyConversationAPI',
    }));
  },
};
