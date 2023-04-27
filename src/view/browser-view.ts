import Queue from 'queue';
import gui from 'gui';
import {Signal} from 'typed-signals';

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
    this.browser.beginAddingBindings();
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

  loadHTML(html: string, baseURL: string) {
    this.#queue.end();
    this.isDomReady = false;
    this.browser.loadHTML(html, baseURL);
  }

  // Promise version of executeJavaScript.
  executeJavaScript(js: string) {
    if (!this.isDomReady)
      throw new Error('Can not call executeJavaScript before page is loaded.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<any>((resolve, reject) => {
      this.browser.executeJavaScript(js, (success: boolean, value) => {
        if (success)
          resolve(value);
        else
          reject(new Error('Failed to execute JavaScript.'));
      });
    });
  }

  // Push a task will be executed one by one in a queue.
  // If the browser is not ready yet, the tasks will be delayed until page is
  // fully loaded.
  // If the browser loads another page before current page is ready, the tasks
  // will be cancelled.
  pushTask(callback: (cb?) => void | Promise<void>) {
    this.#queue.push(callback);
    if (this.isDomReady)
      this.#queue.start();
  }

  // Wrapper of pushTask and executeJavaScript.
  pushJavaScript(js: string) {
    this.pushTask(cb => this.browser.executeJavaScript(js, () => cb()));
  }

  // Return cookie string in the format of |document.cookie|, but include http
  // only cookies.
  getCookie(url: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.browser.getCookiesForURL(url, (cookies) => {
        resolve(cookies.map(c => `${c.name}=${c.value}`).join('; '));
      });
    });
  }

  #domReady() {
    // Only show browser when it is loaded, this can remove the white flash.
    // Note that we put setVisible in queue to execute so the browser only
    // shows when pending executeJavaScript tasks are executed, which can avoid
    // flickers.
    this.#queue.push(cb => {
      this.browser.setVisible(true);
      cb();
    });
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
