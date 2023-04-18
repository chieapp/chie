import BaseWindow from '../src/view/base-window';
import WindowMenuBar from '../src/view/window-menu-bar';
import apiManager from '../src/controller/api-manager';
import serviceManager from '../src/controller/service-manager';
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

  it('does not reference removed instance', async () => {
    let collected = false;
    (() => {
      const win = new BaseWindow();
      const menubar = new WindowMenuBar(win);
      const endpoint = apiManager.getEndpointsByType('DummyCompletionAPI')[0];
      const instance = serviceManager.createInstance('TestChat 1', 'DummyCompletionChatService', endpoint);
      addFinalizer(menubar, () => collected = true);
      serviceManager.removeInstanceById(instance.id);
      menubar.destructor();
      win.window.close();
    })();
    await gcUntil(() => collected);
  });
});
