import crypto from 'node:crypto';
import fs from 'fs-extra';
import gui from 'gui';
import path from 'node:path';

import Icon from '../model/icon';
import WebService from '../model/web-service';
import {BaseViewType} from '../view/base-view';

export default class Assistant {
  id?: string;
  service: WebService;
  viewClass: BaseViewType;

  shortcut?: string;
  shortcutId?: number;

  tray?: gui.Tray;
  trayIcon?: Icon;

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
    if (this.tray)  // remove existing tray
      this.tray.remove();
    if (trayIcon) {  // create new one
      this.trayIcon = trayIcon;
      this.tray = gui.Tray.createWithImage(this.trayIcon.getImage());
      this.tray.onClick = this.onActivate.bind(this);
    } else {  // remove record
      this.tray = null;
      this.trayIcon = null;
    }
  }

  onActivate() {
    const windowManager = require('../controller/window-manager').default;
    windowManager.showChatWindow(this.id);
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
