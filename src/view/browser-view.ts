import Queue from 'queue';
import gui from 'gui';
import {Signal} from 'typed-signals';
import {realpathSync} from 'node:fs';

import AppearanceAware from '../view/appearance-aware';

export const style = {
  padding: 14,
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

  constructor() {
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
    if (this.darkMode)
      this.browser.setBackgroundColor(style.dark.bgColor);
    this.browser.setVisible(false);  // hidden util loaded
    this.view.addChildView(this.browser);

    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('domReady', this.#domReady.bind(this));
    this.browser.addBinding('catchDomError', this.#catchDomError.bind(this));
    this.browser.addBinding('log', this.#log.bind(this));

    // Calls of executeJavaScript are queued.
    this.#queue = new Queue({concurrency: 1, autostart: false});
  }

  loadHtml(html: string, baseUrl: string) {
    this.#queue.end();
    this.isDomReady = false;
    this.browser.loadHTML(html, baseUrl);
  }

  executeJavaScript(js: string) {
    this.#queue.push(cb => this.browser.executeJavaScript(js, () => cb()));
    if (this.isDomReady)
      this.#queue.start();
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
