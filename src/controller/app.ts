import gui from 'gui';

import AppMenuBar from '../view/app-menu-bar';
import AppTray from '../view/app-tray';
import {ConfigStoreItem} from '../model/config-store';
import {collectGarbage} from './gc-center';

interface AppData {
  hideTrayIcon?: boolean;
  hideDockIcon?: boolean;
  notFirstTime?: boolean;
}

export class App extends ConfigStoreItem {
  firstTimeStart = true;
  menuBar?: AppMenuBar;
  tray?: AppTray;

  constructor() {
    super();
  }

  deserialize(data: AppData) {
    if (typeof data != 'object')  // accepts empty data
      data = {};
    if (!data.hideTrayIcon)
      this.tray = new AppTray();
    if (process.platform == 'darwin' && data.hideDockIcon)
      this.setDockIconVisible(false);
    if (data.notFirstTime)
      this.firstTimeStart = false;
    // There is no config for menuBar but we should only create it after config
    // is read.
    if (process.platform == 'darwin')
      this.menuBar = new AppMenuBar();
  }

  serialize() {
    const data: AppData = {notFirstTime: true};
    if (!this.tray)
      data.hideTrayIcon = true;
    if (process.platform == 'darwin' && !this.isDockIconVisible())
      data.hideDockIcon = true;
    return data;
  }

  setDockIconVisible(visible: boolean) {
    if (visible) {
      gui.app.setActivationPolicy('regular');
    } else {
      gui.app.setActivationPolicy('accessory');
      // Hidding dock icon would remove focus from app.
      gui.app.activate(true);
    }
    this.saveConfig();
  }

  isDockIconVisible() {
    if (process.platform != 'darwin')
      return false;
    return gui.app.getActivationPolicy() == 'regular';
  }

  setHasTray(has: boolean) {
    if (has == !!this.tray)
      return;
    if (has) {
      this.tray = new AppTray();
    } else {
      this.tray.tray.remove();
      this.tray = null;
      collectGarbage();
    }
    this.saveConfig();
  }
}

export default new App();
