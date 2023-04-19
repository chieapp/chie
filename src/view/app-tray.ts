import fs from 'node:fs';
import gui from 'gui';
import path from 'node:path';

import AssistantsMenu from './assistants-menu';
import BaseMenuBar from './base-menu-bar';
import {getWindowManager} from './base-menu-bar';

export default class AppTray {
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
        onClick() { getWindowManager().showNamedWindow('dashboard'); },
      },
      {
        label: 'New Assistant...',
        onClick() { getWindowManager().showNamedWindow('newAssistant'); },
      },
      { type: 'separator' },
      { type: 'separator' },
      ...BaseMenuBar.fileMenuItems,
    ]);
    this.#assistantsMenu = new AssistantsMenu(this.menu, 3, (instance) => ({
      label: `Open ${instance.service.name}...`,
      onClick: () => getWindowManager().showChatWindow(instance),
    }));
    this.tray.setMenu(this.menu);
  }

  destructor() {
    this.tray.remove();
    this.#assistantsMenu.destructor();
  }
}
