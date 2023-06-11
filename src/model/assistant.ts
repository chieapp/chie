import crypto from 'node:crypto';
import fs from 'fs-extra';
import gui from 'gui';
import path from 'node:path';

import DashboardWindow from '../view/dashboard-window';
import Icon from '../model/icon';
import WebService from '../model/web-service';
import assistantManager from '../controller/assistant-manager';
import {BaseViewType} from '../view/base-view';
import {collectGarbage} from '../controller/gc-center';

export default class Assistant {
  id: string;
  service: WebService;
  viewClass: BaseViewType;

  shortcut?: string;
  shortcutId?: number;

  tray?: gui.Tray;
  trayIcon?: Icon;
  trayMenu?: gui.Menu;

  constructor(id: string, service: WebService, viewClass: BaseViewType) {
    this.id = id;
    this.service = service;
    this.viewClass = viewClass;
    if (service.icon)
      service.icon = this.#copyIcon(service.icon);
  }

  destructor() {
    this.setShortcut(null);
    this.setTrayIcon(null);
    this.#removeIcon(this.service.icon);
    this.service.destructor();
  }

  setIcon(icon: Icon) {
    this.#removeIcon(this.service.icon);
    this.service.setIcon(this.#copyIcon(icon));
  }

  setShortcut(shortcut: string | null) {
    if (this.shortcut == shortcut)
      return;
    if (this.shortcut)
      gui.globalShortcut.unregister(this.shortcutId);
    this.shortcut = shortcut;
    if (shortcut)
      this.shortcutId = gui.globalShortcut.register(shortcut, this.onActivate.bind(this));
    else
      this.shortcutId = null;
  }

  setTrayIcon(trayIcon: Icon | null) {
    if (this.trayIcon == trayIcon)  // ignore when icon is not changed
      return;
    if (this.tray) {  // remove existing tray
      this.tray.remove();
      this.#removeIcon(this.trayIcon);
    }
    if (trayIcon) {  // create new one
      if (trayIcon.getImage().getSize().width > 22)
        this.trayIcon = this.#resizeIcon(trayIcon, {width: 16, height: 16});
      else
        this.trayIcon = trayIcon;
      this.tray = gui.Tray.createWithImage(this.trayIcon.getImage());
      if (process.platform != 'darwin') {
        this.trayMenu = gui.Menu.create([
          {
            label: `Open ${this.service.name}...`,
            onClick: this.onActivate.bind(this),
          },
          {
            label: 'Open in Dashboard...',
            onClick: this.onActivateDashboard.bind(this),
          },
        ]);
        this.tray.setMenu(this.trayMenu);
      }
      this.tray.onClick = this.onActivate.bind(this);
    } else {  // remove record
      this.tray = null;
      this.trayIcon = null;
      this.trayMenu = null;
      collectGarbage();
    }
  }

  onActivate() {
    const windowManager = require('../controller/window-manager').default;
    windowManager.showChatWindow(this.id);
  }

  onActivateDashboard() {
    const windowManager = require('../controller/window-manager').default;
    const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
    dashboard.switchTo(assistantManager.getAssistants().indexOf(this));
  }

  // Resize the icon and copy it to user data dir.
  #resizeIcon(icon: Icon, size: gui.SizeF) {
    const filename = crypto.randomUUID() + '@2x.png';
    const newIcon = new Icon({
      image: icon.getImage().resize(size, 2),
      filePath: path.join(Icon.userIconsPath, filename),
    });
    fs.outputFileSync(newIcon.filePath, newIcon.getImage().toPNG());
    return newIcon;
  }

  // If the icon file is located outside app's bundle, copy it to user data dir.
  #copyIcon(icon: Icon) {
    if (icon.filePath.startsWith(Icon.builtinIconsPath))
      return icon;
    const filename = crypto.randomUUID() + path.extname(icon.filePath);
    const filePath = path.join(Icon.userIconsPath, filename);
    fs.copySync(icon.filePath, filePath);
    return new Icon({filePath});
  }

  // If the icon file is managed by us, remove it.
  #removeIcon(icon: Icon) {
    if (icon.filePath.startsWith(Icon.userIconsPath))
      fs.remove(icon.filePath);
  }
}
