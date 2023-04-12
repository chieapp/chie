import ChatService from './model/chat-service';
import ChatView from './view/chat-view';
import MultiChatsService from './model/multi-chats-service';
import MultiChatsView from './view/multi-chats-view';
import apiManager from './controller/api-manager';
import serviceManager from './controller/service-manager';
import extensionManager from './controller/extension-manager';
import {ChatConversationAPI, ChatCompletionAPI} from './model/chat-api';
import {config} from './controller/config-store';

export default function main() {
  // Register builtin APIs and services.
  serviceManager.registerView(ChatView);
  serviceManager.registerView(MultiChatsView);
  serviceManager.registerService('ChatService', {
    serviceType: ChatService,
    viewType: ChatView,
    apiTypes: [ChatConversationAPI, ChatCompletionAPI],
  });
  serviceManager.registerService('MultiChatsService', {
    serviceType: MultiChatsService,
    viewType: MultiChatsView,
    apiTypes: [ChatCompletionAPI],
  });

  // Activate extensions.
  extensionManager.activate();

  // Read configurations.
  config.addItem('apis', apiManager);
  config.addItem('chats', serviceManager);
  config.initFromFileSync();
}
