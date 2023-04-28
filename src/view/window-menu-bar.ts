import BaseMenuBar from './base-menu-bar';
import BaseWindow from './base-window';
import {BaseViewType} from './base-view';

export default class WindowMenuBar extends BaseMenuBar {
  constructor(win: BaseWindow, viewType?: BaseViewType) {
    const template = [
      // File menu.
      {
        label: 'File',
        submenu: BaseMenuBar.fileMenuItems,
      },
    ];
    super(template);

    // For dashboard create items for all registered views.
    const DashboardWindow = require('./dashboard-window').default;
    if (win instanceof DashboardWindow) {
      this.createAssistantsMenu();
      this.createViewMenu(this.getAllViewMenuItems());
      this.createAssistantsItemsInViewMenu();
      return;
    }

    // For other windows add items for view type.
    if (!viewType)
      return;
    // Create "Assistants" menu.
    this.createAssistantsMenu();
    // For "View" menu, get the items for the main view first.
    const items = [
      {type: 'separator'},
      ...this.getViewMenuItems(viewType),
    ];
    // If the main view includes a sub main view, get its items too.
    if (viewType.getSubViewType) {
      items.push(
        {type: 'separator'},
        ...this.getViewMenuItems(viewType.getSubViewType()));
    }
    this.createViewMenu(items);
  }
}
