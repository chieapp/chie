import gui from 'gui';

import AppMenuBar from '../view/app-menu-bar';
import BaseWindow, {WindowState} from '../view/base-window';
import ChatWindow from '../view/chat-window';
import DashboardWindow from '../view/dashboard-window';
import Instance from '../model/instance';
import NewAssistantWindow from '../view/new-assistant-window';
import serviceManager from './service-manager';
import {collectGarbage} from './gc-center';
import {ConfigStoreItem} from './config-store';

export class WindowManager extends ConfigStoreItem {
  #appMenu?: AppMenuBar;
  #windows: BaseWindow[] = [];

  #newAssistantWindow?: NewAssistantWindow;
  #dashboard?: DashboardWindow;
  #chatWindows: Record<string, ChatWindow> = {};

  #dashboardState?: WindowState;
  #chatWindowStates: Record<string, WindowState> = {};

  constructor() {
    super();
    if (process.platform == 'darwin')
      gui.lifetime.onActivate = () => this.showDashboardWindow();
    serviceManager.onRemoveInstance.connect(this.#onRemoveInstance.bind(this));
  }

  deserialize(data: object) {
    if (!data)  // accepts empty data
      data = {};
    if (process.platform == 'darwin') {
      // Create menu bar after config is loaded.
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
    this.#dashboardState = null;
    if (typeof data['dashboard'] == 'object') {
      this.#dashboardState = data['dashboard']['state'];
      if (data['dashboard']['opened'])
        this.showDashboardWindow();
    }
  }

  serialize() {
    const chatWindows = {};
    for (const id in this.#chatWindowStates) {
      chatWindows[id] = {
        state: this.#chatWindowStates[id],
        opened: id in this.#chatWindows,
      };
    }
    return {
      chatWindows,
      dashboard: {
        state: this.#dashboardState,
        opened: !!this.#dashboard,
      },
    };
  }

  showNewAssistantWindow() {
    if (!this.#newAssistantWindow) {
      this.#newAssistantWindow = new NewAssistantWindow();
      this.#newAssistantWindow.window.onClose = () => this.#newAssistantWindow = null;
    }
    this.#newAssistantWindow.window.activate();
  }

  showDashboardWindow() {
    // Create dashboard window lazily.
    if (!this.#dashboard) {
      this.#dashboard = new DashboardWindow();
      if (this.#dashboardState)
        this.#dashboard.restoreState(this.#dashboardState);
      else
        this.#dashboard.window.center();
      // Destroy the dashboard on close, it is possible to just cache it but it
      // can be recreated very fast so save some memory here.
      this.#dashboard.window.onClose = () => {
        this.#saveDashboardState();
        this.#dashboard = null;
        this.saveConfig();
      };
    }
    this.#dashboard.window.activate();
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
    this.#saveDashboardState();
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

  #saveDashboardState() {
    if (this.#dashboard)
      this.#dashboardState = this.#dashboard.saveState();
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

  #onAllWindowsClosed() {
    if (process.platform != 'darwin')
      this.quit();
  }

  #onRemoveInstance(instance: Instance) {
    this.#chatWindows[instance.id]?.window.close();
    delete this.#chatWindowStates[instance.id];
    this.#saveDashboardState();
    this.saveConfig();
  }
}

export default new WindowManager();
