import gui from 'gui';
import serviceManager from '../controller/service-manager';

export default class MenuBar {
  static quitMenuItem = {
    label: 'Quit',
    accelerator: 'CmdOrCtrl+Q',
    onClick() { getWindowManager().quit(); },
  };
  static editMenu = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'select-all' },
    ],
  };
  static assistantsMenu = {
    label: 'Assistants',
    submenu: [
      {
        label: 'New Assistant',
        accelerator: 'Shift+CmdOrCtrl+N',
        onClick() { getWindowManager().showNewAssistantWindow(); },
      },
    ],
  };

  menu: gui.MenuBar;

  constructor(template: object[]) {
    this.menu = gui.MenuBar.create(template);
  }
}

export function getWindowManager() {
  // Delay loaded to avoid circular reference.
  return require('../controller/window-manager').default;
}
