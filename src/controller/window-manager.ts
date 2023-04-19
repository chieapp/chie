import gui from 'gui';

import AppTray from '../view/app-tray';
import AppMenuBar from '../view/app-menu-bar';
import BaseWindow, {WindowState} from '../view/base-window';
import ChatWindow from '../view/chat-window';
import Instance from '../model/instance';
import serviceManager from './service-manager';
import {collectGarbage} from './gc-center';
import {ConfigStoreItem} from './config-store';

type NamedWindowType = new () => BaseWindow;

export class WindowManager extends ConfigStoreItem {
  #appMenu?: AppMenuBar;
  #appTray?: AppTray;
  #windows: BaseWindow[] = [];

  #registeredWindows: Record<string, NamedWindowType> = {};
  #namedWindows: Record<string, BaseWindow> = {};
  #chatWindows: Record<string, ChatWindow> = {};

  #namedWindowsStates: Record<string, WindowState> = {};
  #chatWindowStates: Record<string, WindowState> = {};

  constructor() {
    super();
    serviceManager.onRemoveInstance.connect(this.#onRemoveInstance.bind(this));
  }

  deserialize(data: object) {
    if (!data)  // accepts empty data
      data = {};
    if (process.platform == 'darwin') {
      // Create menu bar after config is loaded.
      this.#appTray = new AppTray();
      this.#appMenu = new AppMenuBar();
      gui.app.setApplicationMenu(this.#appMenu.menu);
    }
    this.#chatWindowStates = {};
    if (typeof data['chatWindows'] == 'object') {
      for (const id in data['chatWindows']) {
        const wd = data['chatWindows'][id];
        this.#chatWindowStates[id] = wd['state'];
        if (wd['opened'])
          this.showChatWindow(serviceManager.getInstanceById(id));
      }
    }
    if (typeof data['windows'] == 'object') {
      for (const name in data['windows']) {
        const wd = data['windows'][name];
        this.#namedWindowsStates[name] = wd['state'];
        if (wd['opened'])
          this.showNamedWindow(name);
      }
    }
  }

  serialize() {
    const data = {chatWindows: {}, windows: {}};
    for (const id in this.#chatWindowStates) {
      data.chatWindows[id] = {
        state: this.#chatWindowStates[id],
        opened: id in this.#chatWindows,
      };
    }
    for (const name in this.#namedWindowsStates) {
      data.windows[name] = {
        state: this.#namedWindowsStates[name],
        opened: !!this.#namedWindows[name],
      };
    }
    return data;
  }

  registerNamedWindow(name: string, windowType: NamedWindowType) {
    if (name in this.#registeredWindows)
      throw new Error(`Window name "${name}" has already been registered.`);
    this.#registeredWindows[name] = windowType;
  }

  // Create and show a registered window type with |name|. The window is created
  // lazily and will be destroyed when closed.
  showNamedWindow(name: string) {
    let win = this.#namedWindows[name];
    if (!win) {
      const windowType = this.#registeredWindows[name];
      if (!windowType)
        throw new Error(`There is no window named "${name}".`);
      win = this.#namedWindows[name] = new windowType();
      if (name in this.#namedWindowsStates)
        win.restoreState(this.#namedWindowsStates[name]);
      else
        win.window.center();
      win.window.onClose = () => {
        this.#saveNamedWindowState(name);
        // It is possible to cache, but windows are cheap to create in Chie so
        // we just recreate the window every time.
        delete this.#namedWindows[name];
        this.saveConfig();
      };
    }
    win.window.activate();
  }

  showChatWindow(instance: Instance) {
    if (!(instance.id in this.#chatWindows)) {
      const win = new ChatWindow(instance);
      if (instance.id in this.#chatWindowStates)
        win.restoreState(this.#chatWindowStates[instance.id]);
      else
        win.window.center();
      win.window.onClose = () => {
        this.#saveChatWindowState(win);
        delete this.#chatWindows[instance.id];
        this.saveConfig();
      };
      this.#chatWindows[instance.id] = win;
    }
    this.#chatWindows[instance.id].window.activate();
  }

  getCurrentWindow() {
    return this.#windows.find(w => w.window.isActive());
  }

  quit() {
    // Save states before quitting.
    this.#saveChatWindowStates();
    this.#saveNamedWindowStates();
    this.saveConfigSync();
    // Quit.
    if (gui.MessageLoop.quit)
      gui.MessageLoop.quit();
    process.exit(0);
  }

  addWindow(win: BaseWindow) {
    this.#windows.push(win);
  }

  removeWindow(win: BaseWindow) {
    this.#windows.splice(this.#windows.indexOf(win), 1);
    if (this.#windows.length == 0)
      this.#onAllWindowsClosed();
    collectGarbage();
  }

  #saveChatWindowState(win: ChatWindow) {
    this.#chatWindowStates[win.instance.id] = win.saveState();
  }

  #saveChatWindowStates() {
    for (const win of this.#windows) {
      if (win instanceof ChatWindow)
        this.#saveChatWindowState(win as ChatWindow);
    }
  }

  #saveNamedWindowState(name: string) {
    const win = this.#namedWindows[name];
    if (!win)  // not opened
      return;
    const state = win.saveState();
    if (state)
      this.#namedWindowsStates[name] = state;
    else  // some windows explicitly do not keep states
      delete this.#namedWindowsStates[name];
  }

  #saveNamedWindowStates() {
    for (const name in this.#namedWindows)
      this.#saveNamedWindowState(name);
  }

  #onAllWindowsClosed() {
    if (!this.#appTray && process.platform != 'darwin')
      this.quit();
  }

  #onRemoveInstance(instance: Instance) {
    this.#chatWindows[instance.id]?.window.close();
    delete this.#chatWindowStates[instance.id];
    this.#saveNamedWindowState('dashboard');
    this.saveConfig();
  }
}

export default new WindowManager();
