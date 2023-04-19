import BaseMenuBar from './base-menu-bar';
import BaseWindow from './base-window';
import {BaseViewType} from './base-view';

export default class WindowMenuBar extends BaseMenuBar {
  constructor(win: BaseWindow) {
    const template = [
      // File menu.
      {
        label: 'File',
        submenu: BaseMenuBar.fileMenuItems,
      },
    ];
    super(template);

    const mainView = win.getMainView();
    if (mainView) {
      // Create "Assistants" menu.
      this.createAssistantsMenu();
      // For "View" menu, get the items for the main view first.
      const items = [
        {type: 'separator'},
        ...this.getViewMenuItems(mainView.constructor as BaseViewType),
      ];
      // If the main view includes a sub main view, get its items too.
      if (mainView.getMainView()) {
        items.push(
          {type: 'separator'},
          ...this.getViewMenuItems(mainView.getMainView().constructor as BaseViewType));
      }
      this.createViewMenu(items);
      // Create assistant switcher in dashboard.
      const DashboardWindow = require('./dashboard-window').default;
      if (win instanceof DashboardWindow)
        this.createAssistantsItemsInViewMenu();
    }
  }
}
