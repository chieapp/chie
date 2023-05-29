import gui from 'gui';

import BaseWindow from '../view/base-window';
import Instance from '../model/instance';
import WindowStore, {WindowStoreData} from '../model/window-store';
import serviceManager from './service-manager';
import {collectGarbage} from './gc-center';
import {ConfigStoreItem} from '../model/config-store';

type WindowManagerData = {
  windows?: WindowStoreData,
  chatWindows?: WindowStoreData,
};

type NamedWindowType = new () => BaseWindow;

export class WindowManager extends ConfigStoreItem {
  // Do not quit when all windows are closed.
  quitOnAllWindowsClosed = true;

  // Saves all windows.
  windows: BaseWindow[] = [];
  // Chat windows, using instance id as name.
  #chatWindows: WindowStore;
  // Global windows, each window has its own type.
  #registeredWindows: Record<string, NamedWindowType> = {};
  #namedWindows: WindowStore;

  constructor() {
    super();
    this.#chatWindows = new WindowStore((id) => {
      const ChatWindow = require('../view/chat-window').default;
      return new ChatWindow(serviceManager.getInstanceById(id));
    });
    this.#namedWindows = new WindowStore((name) => {
      const windowType = this.#registeredWindows[name];
      if (!windowType)
        throw new Error(`There is no window named "${name}".`);
      return new windowType();
    });
    serviceManager.onRemoveInstance.connect(this.#onRemoveInstance.bind(this));
  }

  deserialize(data: WindowManagerData) {
    if (typeof data != 'object')  // accepts empty data
      data = {};
    this.#chatWindows.deserialize(data.chatWindows);
    this.#namedWindows.deserialize(data.windows);
  }

  serialize(): WindowManagerData {
    return {
      chatWindows: this.#chatWindows.serialize(),
      windows: this.#namedWindows.serialize(),
    };
  }

  showChatWindow(id: string) {
    return this.#chatWindows.showWindow(id);
  }

  registerNamedWindow(name: string, windowType: NamedWindowType) {
    if (name in this.#registeredWindows)
      throw new Error(`Window name "${name}" has already been registered.`);
    this.#registeredWindows[name] = windowType;
  }

  getNamedWindow(name: string) {
    return this.#namedWindows.getWindow(name);
  }

  getOrCreateNamedWindow(name: string) {
    return this.#namedWindows.getOrCreateWindow(name);
  }

  showNamedWindow(name: string) {
    return this.#namedWindows.showWindow(name);
  }

  getCurrentWindow() {
    return this.windows.find(w => w.window.isActive());
  }

  async quit() {
    // Save states before quitting.
    this.#chatWindows.saveWindowStates();
    this.#namedWindows.saveWindowStates();
    await this.saveConfig();
    // Quit.
    if (gui.MessageLoop.quit)
      gui.MessageLoop.quit();
    process.exit(0);
  }

  addWindow(win: BaseWindow) {
    this.windows.push(win);
  }

  removeWindow(win: BaseWindow) {
    this.windows.splice(this.windows.indexOf(win), 1);
    if (this.windows.length == 0)
      this.#onAllWindowsClosed();
    // A closed window usually has a large chunk of memory to recycle.
    collectGarbage();
    // The |removeWindow| might be called before window saves states, delay a
    // tick to ensure we have the state.
    setImmediate(() => this.saveConfig());
  }

  #onAllWindowsClosed() {
    if (!this.quitOnAllWindowsClosed)
      return;
    const app = require('./app').default;
    if (!app.tray && !app.isDockIconVisible())
      this.quit();
  }

  #onRemoveInstance(instance: Instance) {
    this.#chatWindows.closeWindow(instance.id);
    this.#chatWindows.removeWindowState(instance.id);
    this.#namedWindows.saveWindowState('dashboard');
    this.saveConfig();
  }
}

export default new WindowManager;
