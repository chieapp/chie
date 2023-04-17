import {assert} from 'chai';

import DashboardWindow from '../src/view/dashboard-window';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';

import {addFinalizer, gcUntil} from './util';

describe('DashboardWindow', async () => {
  afterEach(() => {
    serviceManager.deserialize({});
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
});
