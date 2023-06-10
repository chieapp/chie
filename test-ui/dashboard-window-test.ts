import {assert} from 'chai';

import ChatView from '../src/view/chat-view';
import DashboardWindow from '../src/view/dashboard-window';
import MultiChatsService from '../src/model/multi-chats-service';
import apiManager from '../src/controller/api-manager';
import assistantManager from '../src/controller/assistant-manager';
import windowManager from '../src/controller/window-manager';
import {ChatRole} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';

describe('DashboardWindow', async () => {
  afterEach(() => {
    assistantManager.deserialize({});
    windowManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
      assistantManager.createAssistant('TestChat 2', 'MultiChatsService', endpoint, ChatView);
      const dashboard = new DashboardWindow();
      addFinalizer(dashboard, () => collected = true);
      dashboard.switchTo(1);
      dashboard.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('can be garbage collected after sending message', async () => {
    let collected = false;
    await (async () => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
      const dashboard = new DashboardWindow();
      dashboard.restoreState({});
      await (assistant.service as MultiChatsService).chats[0].sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(dashboard, () => collected = true);
      dashboard.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('keep sane when adding/removing assistants', async () => {
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const dashboard = new DashboardWindow();
    assert.equal(dashboard.views.length, 0);
    const i1 = assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
    const i2 = assistantManager.createAssistant('TestChat 2', 'MultiChatsService', endpoint, ChatView);
    const i3 = assistantManager.createAssistant('TestChat 3', 'MultiChatsService', endpoint, ChatView);
    assert.equal(dashboard.views.length, 3);
    assert.equal(dashboard.selectedView, dashboard.views[2]);
    assistantManager.removeAssistantById(i2.id);
    assert.equal(dashboard.views.length, 2);
    assert.equal(dashboard.selectedView, dashboard.views[1]);
    assistantManager.removeAssistantById(i3.id);
    assert.equal(dashboard.views.length, 1);
    assert.equal(dashboard.selectedView, dashboard.views[0]);
    assistantManager.removeAssistantById(i1.id);
    assert.equal(dashboard.views.length, 0);
    assert.equal(dashboard.selectedView, null);
  });

  it('does not reference removed assistant', async () => {
    let collected = false;
    const dashboard = new DashboardWindow();
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const assistant = assistantManager.createAssistant('TestChat 1', 'MultiChatsService', endpoint, ChatView);
      addFinalizer(assistant.service, () => collected = true);
      assistantManager.removeAssistantById(assistant.id);
    })();
    await gcUntil(() => collected);
    dashboard.window.close();
  });
});
