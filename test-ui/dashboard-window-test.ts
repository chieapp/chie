import {assert} from 'chai';

import DashboardWindow from '../src/view/dashboard-window';
import MultiChatsService from '../src/model/multi-chats-service';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
import windowManager from '../src/controller/window-manager';
import {ChatRole} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';

describe('DashboardWindow', async () => {
  afterEach(() => {
    serviceManager.deserialize({});
    windowManager.deserialize({});
  });

  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
      serviceManager.createInstance('TestChat 2', 'DummyCompletionChatService', endpoint);
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
      const instance = serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
      const dashboard = new DashboardWindow();
      await (instance.service as MultiChatsService).chats[0].sendMessage({role: ChatRole.User, content: 'message'});
      addFinalizer(dashboard, () => collected = true);
      dashboard.window.close();
    })();
    await gcUntil(() => collected);
  });

  it('keep sane when adding/removing instances', async () => {
    const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
    const dashboard = new DashboardWindow();
    assert.equal(dashboard.views.length, 0);
    const i1 = serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
    const i2 = serviceManager.createInstance('TestChat 2', 'DummyCompletionChatService', endpoint);
    const i3 = serviceManager.createInstance('TestChat 3', 'DummyCompletionChatService', endpoint);
    assert.equal(dashboard.views.length, 3);
    assert.equal(dashboard.selectedView, dashboard.views[2]);
    serviceManager.removeInstanceById(i2.id);
    assert.equal(dashboard.views.length, 2);
    assert.equal(dashboard.selectedView, dashboard.views[1]);
    serviceManager.removeInstanceById(i3.id);
    assert.equal(dashboard.views.length, 1);
    assert.equal(dashboard.selectedView, dashboard.views[0]);
    serviceManager.removeInstanceById(i1.id);
    assert.equal(dashboard.views.length, 0);
    assert.equal(dashboard.selectedView, null);
  });

  it('does not reference removed instance', async () => {
    let collected = false;
    const dashboard = new DashboardWindow();
    (() => {
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
      addFinalizer(instance.service, () => collected = true);
      serviceManager.removeInstanceById(instance.id);
    })();
    await gcUntil(() => collected);
    dashboard.window.close();
  });
});
