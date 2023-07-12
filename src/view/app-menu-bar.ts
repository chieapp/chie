import gui from 'gui';

import BaseMenuBar from './base-menu-bar';

export default class AppMenuBar extends BaseMenuBar {
  constructor() {
    const template = [
      // The main menu.
      {
        label: require('../../package.json').build.productName,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hide-others' },
          { role: 'unhide' },
          { type: 'separator' },
          ...BaseMenuBar.fileMenuItems,
        ],
      },
    ];
    super(template);

    // Create "Check latest version" menu item.
    this.createVersionMenuItem();
    // Create "Assistants" menu.
    this.createAssistantsMenu();
    // Create "View" menu.
    this.createViewMenu(this.getAllViewMenuItems());
    this.createAssistantsItemsInViewMenu();

    gui.app.setApplicationMenu(this.menu);
  }
}
