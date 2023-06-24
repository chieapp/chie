import SettingsWindow from '../src/view/settings-window';
import {addFinalizer, gcUntil} from './util';

describe('SettingsWindow', async () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const settings = new SettingsWindow();
      addFinalizer(settings, () => collected = true);
      settings.window.close();
    })();
    await gcUntil(() => collected);
  });
});
