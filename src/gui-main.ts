import gui from 'gui';

import ChatService from './model/chat-service';
import ChatView from './view/chat-view';
import DashboardWindow from './view/dashboard-window';
import MultiChatsService from './model/multi-chats-service';
import MultiChatsView from './view/multi-chats-view';
import NewAPIWindow from './view/new-api-window';
import NewAssistantWindow from './view/new-assistant-window';
import Param from './model/param';
import SettingsWindow from './view/settings-window';
import apiManager from './controller/api-manager';
import app from './controller/app';
import extensionManager from './controller/extension-manager';
import serviceManager from './controller/service-manager';
import windowManager from './controller/window-manager';
import * as singleInstance from './util/single-instance';
import {ChatConversationAPI, ChatCompletionAPI} from './model/chat-api';
import {config, windowConfig} from './controller/configs';
import {setQuitOnException} from './controller/exception-handler';

// Check if it is Yode.
if (!process.versions.yode)
  throw new Error('Can only run under Yode runtime.');

if (process.platform == 'darwin') {
  gui.lifetime.onReady = guiMain;
} else {
  if (singleInstance.quickCheckSync())
    checkSingleInstanceAndStart();
  else
    guiMain();
}

function guiMain() {
  // Register builtin views.
  serviceManager.registerView(MultiChatsView);
  serviceManager.registerView(ChatView);

  // Register builtin services.
  const chatServiceParams: Param[] = [
    {
      name: 'systemPrompt',
      type: 'paragraph',
      readableName: 'System Prompt',
    },
    {
      name: 'contextLength',
      type: 'number',
      readableName: 'Context Length',
      description: 'Maximum number of messages to send per request, default is no limit.',
    },
  ];
  serviceManager.registerService({
    name: 'MultiChatsService',
    serviceType: MultiChatsService,
    viewType: MultiChatsView,
    apiTypes: [ChatConversationAPI, ChatCompletionAPI],
    description: 'Chat interface supporting multiple conversations.',
    priority: 10,
    params: chatServiceParams,
  });
  serviceManager.registerService({
    name: 'ChatService',
    serviceType: ChatService,
    viewType: ChatView,
    apiTypes: [ChatConversationAPI, ChatCompletionAPI],
    description: 'Simple chat interface.',
    priority: 9,
    params: chatServiceParams,
  });

  // Activate extensions.
  extensionManager.activate();

  // Read config and initialize.
  config.addItem('apis', apiManager);
  config.addItem('services', serviceManager);
  config.addItem('app', app);
  config.initFromFileSync();

  // Register named windows.
  windowManager.registerNamedWindow('dashboard', DashboardWindow);
  windowManager.registerNamedWindow('settings', SettingsWindow);
  windowManager.registerNamedWindow('newAssistant', NewAssistantWindow);
  windowManager.registerNamedWindow('newAPI', NewAPIWindow);

  // Restore window states from config.
  windowConfig.addItem('windows', windowManager);
  windowConfig.initFromFileSync();

  // When there is no window available, clicking on the dock icon should show
  // the dashboard window.
  if (process.platform == 'darwin')
    gui.lifetime.onActivate = () => windowManager.showNamedWindow('dashboard');

  // For non-mac platforms, show the dashboard when there is no tray icon and
  // no opened windows.
  if (process.platform != 'darwin' && windowManager.windows.length == 0 && !app.tray)
    windowManager.showNamedWindow('dashboard');

  // After windows are initialized, all errors happened later are usually not
  // critical and we do not need to quit.
  setQuitOnException(false);

  // After a successful start, we want to write current state into file.
  config.saveToFile();
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
