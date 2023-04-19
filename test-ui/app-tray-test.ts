import AppTray from '../src/view/app-tray';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
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

  it('does not reference removed instance', async () => {
    let collected = false;
    (() => {
      const tray = new AppTray();
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
      addFinalizer(tray, () => collected = true);
      serviceManager.removeInstanceById(instance.id);
      tray.destructor();
    })();
    await gcUntil(() => collected);
  });
});
