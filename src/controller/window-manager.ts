import gui from 'gui';
import AppMenu from '../view/app-menu';
import BaseWindow, {WindowState} from '../view/base-window';
import ChatWindow from '../view/chat-window';
import DashboardWindow from '../view/dashboard-window';
import Instance from '../model/instance';
import {windowConfig, ConfigStoreItem} from './config-store';
import {collectGarbage} from './gc-center';

export class WindowManager implements ConfigStoreItem {
  #appMenu?: AppMenu;
  #windows: BaseWindow[] = [];

  #dashboard?: DashboardWindow;
  #chatWindows: Record<string, ChatWindow> = {};

  #dashboardState?: WindowState;

  constructor() {
    if (process.platform == 'darwin') {
      this.#appMenu = new AppMenu();
      gui.app.setApplicationMenu(this.#appMenu.menu);
      gui.lifetime.onActivate = () => this.getDashboard().window.activate();
    }
  }

  deserialize(data: object) {
    if (typeof data['dashboard'] == 'object') {
      this.#dashboardState = data['dashboard']['state'];
      if (data['dashboard']['opened'])
        this.getDashboard().window.activate();
    }
  }

  serialize() {
    return {
      dashboard: {
        state: this.#dashboardState,
        opened: !!this.#dashboard,
      },
    };
  }

  getChatWindow(instance: Instance) {
    if (!this.#chatWindows[instance.id]) {
      const win = new ChatWindow(instance);
      win.window.onClose = () => {
        delete this.#chatWindows[instance.id];
        windowConfig.saveToFile();
      };
      this.#chatWindows[instance.id] = win;
    }
    return this.#chatWindows[instance.id];
  }

  getDashboard() {
    // Create dashboard window lazily.
    if (!this.#dashboard) {
      this.#dashboard = new DashboardWindow();
      if (this.#dashboardState)
        this.#dashboard.restoreState(this.#dashboardState);
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

  getCurrentWindow() {
    return this.#windows.find(w => w.window.isActive());
  }

  quit() {
    // Save states before quitting.
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
    windowConfig.saveToFile();
    collectGarbage();
  }

  #saveDashboardState() {
    if (this.#dashboard)
      this.#dashboardState = this.#dashboard.saveState();
  }

  #onAllWindowsClosed() {
    if (process.platform != 'darwin')
      this.quit();
  }
}

export default new WindowManager();
