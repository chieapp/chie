import AppTray from '../src/view/app-tray';
import ChatView from '../src/view/chat-view';
import apiManager from '../src/controller/api-manager';
import assistantManager from '../src/controller/assistant-manager';
import {addFinalizer, gcUntil} from './util';

describe('AppTray', () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const tray = new AppTray();
      addFinalizer(tray, () => collected = true);
      tray.destructor();
    })();
    await gcUntil(() => collected);
  });

  it('does not reference removed assistant', async () => {
    let collected = false;
    (() => {
      const tray = new AppTray();
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
      addFinalizer(tray, () => collected = true);
      assistantManager.removeAssistantById(assistant.id);
      tray.destructor();
    })();
    await gcUntil(() => collected);
  });
});
