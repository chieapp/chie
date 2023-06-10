import BaseWindow from '../src/view/base-window';
import ChatView from '../src/view/chat-view';
import WindowMenuBar from '../src/view/window-menu-bar';
import apiManager from '../src/controller/api-manager';
import assistantManager from '../src/controller/assistant-manager';
import {addFinalizer, gcUntil} from './util';

describe('WindowMenuBar', () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const win = new BaseWindow();
      const menubar = new WindowMenuBar(win);
      addFinalizer(menubar, () => collected = true);
      menubar.destructor();
      win.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('does not reference removed assistant', async () => {
    let collected = false;
    (() => {
      const win = new BaseWindow();
      const menubar = new WindowMenuBar(win);
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
      addFinalizer(menubar, () => collected = true);
      assistantManager.removeAssistantById(assistant.id);
      menubar.destructor();
      win.window.close();
    })();
    await gcUntil(() => collected);
  });
});
