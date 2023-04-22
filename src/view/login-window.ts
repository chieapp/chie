import gui from 'gui';

import BaseWindow from './base-window';
import BrowserView from './browser-view';

export default class LoginWindow extends BaseWindow {
  browser: BrowserView;

  constructor(options: {size?: gui.SizeF} = {size: {width: 600, height: 650}}) {
    super({pressEscToClose: true});

    this.browser = new BrowserView();
    this.browser.view.setStyle({flex: 1});
    this.contentView.addChildView(this.browser.view);
    this.window.setTitle('Login');
    this.window.setContentSize(options.size);
    this.window.center();
  }

  waitForNavigation(target: RegExp) {
    return new Promise<void>((resolve, reject) => {
      this.connectYueSignal(this.window.onClose, () => {
        this.connections.disconnectAll();
        reject(new Error('Window is close.'));
      });
      this.connectYueSignal(this.browser.browser.onFinishNavigation, (browser, url) => {
        if (target.test(url)) {
          this.connections.disconnectAll();
          resolve();
        }
      });
    });
  }

  getCookie() {
    return new Promise<string>((resolve, reject) => {
      this.browser.browser.executeJavaScript('document.cookie', (success, cookie) => {
        if (success)
          resolve(cookie);
        else
          reject(new Error('Failed to execute JavaScript.'));
      });
    });
  }
}
