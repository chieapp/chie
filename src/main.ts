import ChatService from './model/chat-service';
import ChatView from './view/chat-view';
import MultiChatsView from './view/multi-chats-view';
import {ChatConversationAPI, ChatCompletionAPI} from './model/chat-api';

import './controller/api-manager';
import serviceManager from './controller/service-manager';
import extensionManager from './controller/extension-manager';

export default function main() {
  // Register builtin APIs and services.
  serviceManager.registerService('Chat', {
    serviceType: ChatService,
    viewTypes: [ChatView, MultiChatsView],
    apiTypes: [ChatConversationAPI, ChatCompletionAPI],
  });
  extensionManager.activate();

  // Read configurations.
  const {config} = require('./controller/config-store');
  config.initFromFile();

  // Capture all errors if succeeded to start.
  require('./util/capture-errors');
}
