import gui from 'gui';

import BaseMenuBar from './base-menu-bar';
import serviceManager from '../controller/service-manager';

export class AppMenuBar extends BaseMenuBar {
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

    // Create "Assistants" menu.
    this.createAssistantsMenu();
    // Create items for all registered views.
    const items: object[] = [];
    for (const view of serviceManager.getRegisteredViews()) {
      const viewItems = this.getViewMenuItems(view);
      if (!viewItems)
        continue;
      if (items.length > 0)
        items.push({type: 'separator'});
      items.push(...viewItems);
    }
    // Create "View" menu.
    this.createViewMenu(items);
    this.createAssistantsItemsInViewMenu();
  }
}

let appMenuBar: AppMenuBar;
export function createAppMenuBar() {
  if (appMenuBar)
    return new Error('AppMenuBar has already been created.');
  appMenuBar = new AppMenuBar;
  gui.app.setApplicationMenu(appMenuBar.menu);
}
