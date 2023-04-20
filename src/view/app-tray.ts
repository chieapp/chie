import fs from 'node:fs';
import gui from 'gui';
import path from 'node:path';

import AssistantsMenu from './assistants-menu';
import BaseMenuBar from './base-menu-bar';
import windowManager from '../controller/window-manager';

export class AppTray {
  tray: gui.Tray;
  menu: gui.Menu;

  #assistantsMenu: AssistantsMenu;

  constructor() {
    const image = gui.Image.createFromPath(fs.realpathSync(path.join(__dirname, '../../assets/icons/tray@2x.png')));
    if (process.platform == 'darwin')
      image.setTemplate(true);
    this.tray = gui.Tray.createWithImage(image);
    this.menu = gui.Menu.create([
      {
        label: 'Open Dashboard...',
        onClick() { windowManager.showNamedWindow('dashboard'); },
      },
      {
        label: 'New Assistant...',
        onClick() { windowManager.showNamedWindow('newAssistant'); },
      },
      { type: 'separator' },
      { type: 'separator' },
      ...BaseMenuBar.fileMenuItems,
    ]);
    this.#assistantsMenu = new AssistantsMenu(this.menu, 3, (instance) => ({
      label: `Open ${instance.service.name}...`,
      onClick: () => windowManager.showChatWindow(instance.id),
    }));
    this.tray.setMenu(this.menu);
  }

  destructor() {
    this.tray.remove();
    this.#assistantsMenu.destructor();
  }
}

let appTray: AppTray;
export function createAppTray() {
  if (appTray)
    throw new Error('AppTray has already been created.');
  appTray = new AppTray();
}

export function getAppTray() {
  return appTray;
}
