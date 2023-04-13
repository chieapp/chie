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
});
