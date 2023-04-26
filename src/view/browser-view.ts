import Queue from 'queue';
import gui from 'gui';
import {Signal} from 'typed-signals';
import {realpathSync} from 'node:fs';

import AppearanceAware from '../view/appearance-aware';

export const style = {
  light: {
    bgColor: '#FFF',
  },
  dark: {
    bgColor: '#1B1D21',
  }
};

export default class BrowserView extends AppearanceAware {
  browser: gui.Browser;
  isDomReady = false;

  onDomReady: Signal<() => void> = new Signal();

  #queue: Queue;

  constructor(options: {hideUntilLoaded?: boolean} = {}) {
    super();
    // The background color of this view should be the same with the browser,
    // so there would be no flashing when browser is loaded later.
    this.setBackgroundColor(style.light.bgColor, style.dark.bgColor);
    this.browser = gui.Browser.create({
      devtools: true,
      contextMenu: true,
      allowFileAccessFromFiles: true,
      hardwareAcceleration: false,
    });
    this.browser.setStyle({flex: 1});
    this.browser.onFinishNavigation = this.#domReady.bind(this);
    if (this.darkMode)
      this.browser.setBackgroundColor(style.dark.bgColor);
    if (options.hideUntilLoaded)
      this.browser.setVisible(false);
    this.view.addChildView(this.browser);

    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('catchDomError', this.#catchDomError.bind(this));
    this.browser.addBinding('log', this.#log.bind(this));

    // Calls of executeJavaScript are queued.
    this.#queue = new Queue({concurrency: 1, autostart: false});
  }

  loadURL(url: string) {
    this.#queue.end();
    this.isDomReady = false;
    this.browser.loadURL(url);
  }

  loadHTML(html: string, baseUrl: string) {
    this.#queue.end();
    this.isDomReady = false;
    this.browser.loadHTML(html, baseUrl);
  }

  executeJavaScript(js: string) {
    this.#queue.push(cb => this.browser.executeJavaScript(js, () => cb()));
    if (this.isDomReady)
      this.#queue.start();
  }

  getCookie(url: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.browser.getCookiesForURL(url, (cookies) => {
        resolve(cookies.map(c => `${c.name}=${c.value}`).join('; '));
      });
    });
  }

  getValue<T>(js: string): Promise<T> {
    if (!this.isDomReady)
      throw new Error('Can not call getValue before dom is loaded.');
    return new Promise<T>((resolve, reject) => {
      this.browser.executeJavaScript(js, (success: boolean, value: T) => {
        if (success)
          resolve(value);
        else
          reject(new Error('Failed to execute JavaScript.'));
      });
    });
  }

  #domReady() {
    // Only show browser when it is loaded, this can remove the white flash.
    this.browser.setVisible(true);
    // Start pending works.
    this.isDomReady = true;
    this.onDomReady.emit();
    this.#queue.start();
  }

  #catchDomError(message: string) {
    console.error('Error in browser:', message);
  }

  #log(...args) {
    console.log(...args);
  }
}

// Register chie:// protocol to work around CROS problem with file:// protocol.
gui.Browser.registerProtocol('chie', (url) => {
  const u = new URL(url);
  if (u.host !== 'app-file')
    return gui.ProtocolStringJob.create('text/plain', 'Unsupported type');
  const p = realpathSync(`${__dirname}/../..${u.pathname}`);
  return gui.ProtocolFileJob.create(p);
});
