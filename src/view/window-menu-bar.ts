import BaseMenuBar from './base-menu-bar';
import BaseWindow from './base-window';
import {BaseViewType} from './base-view';

export default class WindowMenuBar extends BaseMenuBar {
  constructor(win: BaseWindow, viewClass?: BaseViewType) {
    const template = [
      // File menu.
      {
        label: 'File',
        submenu: [
          BaseMenuBar.aboutMenuItem,
          ...BaseMenuBar.fileMenuItems,
        ],
      },
    ];
    super(template);

    // Create "Check latest version" menu item.
    this.createVersionMenuItem();

    // For dashboard create items for all registered views.
    const DashboardWindow = require('./dashboard-window').default;
    if (win instanceof DashboardWindow) {
      this.createAssistantsMenu();
      this.createViewMenu(this.getAllViewMenuItems());
      this.createAssistantsItemsInViewMenu();
      return;
    }

    // For other windows add items for view type.
    if (!viewClass)
      return;
    // Create "Assistants" menu.
    this.createAssistantsMenu();
    // For "View" menu, get the items for the main view first.
    const items = [
      {type: 'separator'},
      ...this.getViewMenuItems(viewClass),
    ];
    // If the main view includes a sub main view, get its items too.
    if (viewClass.getSubViewType) {
      items.push(
        {type: 'separator'},
        ...this.getViewMenuItems(viewClass.getSubViewType()));
    }
    this.createViewMenu(items);
  }
}
