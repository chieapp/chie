import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'node:path';

import Icon from '../model/icon';
import WebService from '../model/web-service';
import {BaseViewType} from '../view/base-view';

export interface AssistantOptions {
  shortcut?: string;
  hasTray?: boolean;
}

export default class Assistant {
  id?: string;
  service: WebService;
  viewClass: BaseViewType;
  shortcut?: string;
  hasTray?: boolean;

  constructor(id: string, service: WebService, viewClass: BaseViewType, options?: AssistantOptions) {
    this.id = id;
    this.service = service;
    this.viewClass = viewClass;
    if (options) {
      if (options.shortcut)
        this.setShortcut(options.shortcut);
      if (options.hasTray)
        this.setHasTray(options.hasTray);
    }
    if (service.icon)
      service.icon = this.#copyIcon(service.icon);
  }

  destructor() {
    this.setShortcut(null);
    this.setHasTray(false);
    this.#removeIcon(this.service.icon);
    this.service.destructor();
  }

  setIcon(icon: Icon) {
    this.#removeIcon(this.service.icon);
    this.service.setIcon(this.#copyIcon(icon));
  }

  setShortcut(shortcut: string | null) {
    this.shortcut = shortcut;
    // Load shortcutManager lazily to avoid cyclic reference.
    const shortcutManager = require('../controller/shortcut-manager').default;
    shortcutManager.setShortcutForChatWindow(this.id, shortcut);
  }

  setHasTray(hasTray: boolean) {
    this.hasTray = hasTray;
    // Load trayManager lazily to avoid cyclic reference.
    const trayManager = require('../controller/tray-manager').default;
    trayManager.setTrayForChatWindow(this.id, hasTray ? this.service.icon : null);
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
