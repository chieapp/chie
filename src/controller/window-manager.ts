import gui from 'gui';
import AppMenu from '../view/app-menu';
import BaseWindow, {WindowState} from '../view/base-window';
import ChatWindow from '../view/chat-window';
import DashboardWindow from '../view/dashboard-window';
import Instance from '../model/instance';
import serviceManager from './service-manager';
import {windowConfig, ConfigStoreItem} from './config-store';
import {collectGarbage} from './gc-center';

export class WindowManager implements ConfigStoreItem {
  #appMenu?: AppMenu;
  #windows: BaseWindow[] = [];

  #dashboard?: DashboardWindow;
  #chatWindows: Record<string, ChatWindow> = {};

  #dashboardState?: WindowState;
  #chatWindowStates: Record<string, WindowState> = {};

  constructor() {
    if (process.platform == 'darwin') {
      this.#appMenu = new AppMenu();
      gui.app.setApplicationMenu(this.#appMenu.menu);
      gui.lifetime.onActivate = () => this.getDashboard().window.activate();
    }
  }

  deserialize(data: object) {
    if (typeof data['chatWindows'] == 'object') {
      for (const id in data['chatWindows']) {
        const wd = data['chatWindows'][id];
        this.#chatWindowStates[id] = wd['state'];
        if (wd['opened'])
          this.getChatWindow(serviceManager.getInstanceById(id)).window.activate();
      }
    }
    if (typeof data['dashboard'] == 'object') {
      this.#dashboardState = data['dashboard']['state'];
      if (data['dashboard']['opened'])
        this.getDashboard().window.activate();
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

  getDashboard() {
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
        windowConfig.saveToFile();
      };
    }
    return this.#dashboard;
  }

  getChatWindow(instance: Instance) {
    if (!(instance.id in this.#chatWindows)) {
      const win = new ChatWindow(instance);
      if (instance.id in this.#chatWindowStates)
        win.restoreState(this.#chatWindowStates[instance.id]);
      else
        win.window.center();
      win.window.onClose = () => {
        this.#saveChatWindowState(win);
        delete this.#chatWindows[instance.id];
        windowConfig.saveToFile();
      };
      this.#chatWindows[instance.id] = win;
    }
    return this.#chatWindows[instance.id];
  }

  getCurrentWindow() {
    return this.#windows.find(w => w.window.isActive());
  }

  quit() {
    // Save states before quitting.
    this.#saveChatWindowStates();
    this.#saveDashboardState();
    windowConfig.saveToFileSync();
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
}

export default new WindowManager();
