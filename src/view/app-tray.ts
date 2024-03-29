import fs from 'node:fs';
import gui from 'gui';
import path from 'node:path';

import AssistantsMenu from '../view/assistants-menu';
import BaseMenuBar from '../view/base-menu-bar';
import windowManager from '../controller/window-manager';

export default class AppTray {
  tray: gui.Tray;
  menu: gui.Menu;

  #assistantsMenu: AssistantsMenu;
  #onExitCallback?: () => void;

  constructor() {
    const iconName = process.platform == 'darwin' ? 'tray-mac@2x' : 'tray';
    const image = gui.Image.createFromPath(fs.realpathSync(path.join(__dirname, `../../assets/icons/${iconName}.png`)));
    if (process.platform == 'darwin')
      image.setTemplate(true);
    this.tray = gui.Tray.createWithImage(image);
    this.menu = gui.Menu.create([
      {
        label: 'Open Dashboard...',
        onClick() { windowManager.showNamedWindow('dashboard'); },
      },
      { type: 'separator' },
      { type: 'separator' },
      ...BaseMenuBar.fileMenuItems,
    ]);
    this.#assistantsMenu = new AssistantsMenu(this.menu, 2, null, (assistant) => ({
      label: `Open ${assistant.service.name}...`,
      onClick: () => windowManager.showChatWindow(assistant.id),
    }));
    this.tray.setMenu(this.menu);

    if (process.platform == 'win32') {
      // Click on tray icon to show dashboard window.
      this.tray.onClick = () => windowManager.showNamedWindow('dashboard');
      // Remove tray on exit, Windows does not clean it automatically.
      this.#onExitCallback = () => this.destructor();
      process.on('exit', this.#onExitCallback);
    }
  }

  destructor() {
    this.tray.remove();
    this.#assistantsMenu.destructor();
    if (this.#onExitCallback)
      process.removeListener('exit', this.#onExitCallback);
  }
}
