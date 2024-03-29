import BaseWindow from './base-window';
import BrowserView, {BrowserViewOptions} from './browser-view';
import {CancelledError} from '../model/errors';

export default class BrowserWindow extends BaseWindow {
  browser: BrowserView;

  constructor(options?: BrowserViewOptions) {
    super({pressEscToClose: true});

    this.browser = new BrowserView(options);
    this.browser.view.setStyle({flex: 1});
    this.contentView.addChildView(this.browser.view);
    this.window.setTitle('Login');
    this.window.setContentSize({width: 600, height: 650});
    this.window.center();
  }

  destructor() {
    super.destructor();
    this.browser.destructor();
  }

  waitForNavigation(target: RegExp) {
    return new Promise<void>((resolve, reject) => {
      this.connectYueSignal(this.window.onClose, () => {
        this.connections.disconnectAll();
        reject(new CancelledError('Window is closed.'));
      });
      this.connectYueSignal(this.browser.browser.onFailNavigation, () => {
        this.connections.disconnectAll();
        reject(new Error('Navigation failed.'));
      });
      this.connectYueSignal(this.browser.browser.onFinishNavigation, (browser, url) => {
        if (target.test(url)) {
          this.connections.disconnectAll();
          resolve();
        }
      });
    });
  }
}
