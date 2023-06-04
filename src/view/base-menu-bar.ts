import gui from 'gui';

import AssistantsMenu from './assistants-menu';
import SignalsOwner from '../model/signals-owner';
import serviceManager from '../controller/service-manager';
import windowManager from '../controller/window-manager';
import {BaseViewType} from './base-view';

export default class BaseMenuBar extends SignalsOwner {
  static fileMenuItems = [
    {
      label: 'Settings...',
      accelerator: 'CmdOrCtrl+,',
      onClick() { windowManager.showNamedWindow('settings'); },
    },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      onClick() { windowManager.quit(); },
    },
  ];
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
  static windowMenu = {
    label: 'Window',
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'maximize' },
      { role: 'close-window' },
    ],
  };

  menu: gui.MenuBar;

  #viewMenu?: gui.Menu;
  #assistantsMenu?: AssistantsMenu;
  #assistantsMenuInView?: AssistantsMenu;

  constructor(template: object[]) {
    super();
    // Add Edit menu.
    template.splice(1, 0, BaseMenuBar.editMenu);
    // Add Window menu.
    template.push(BaseMenuBar.windowMenu);
    // Create.
    this.menu = gui.MenuBar.create(template);
  }

  destructor() {
    super.destructor();
    this.#assistantsMenu?.destructor();
    this.#assistantsMenuInView?.destructor();
  }

  protected createViewMenu(items: object[]) {
    this.#viewMenu = gui.Menu.create(items);
    this.menu.insert(gui.MenuItem.create({
      label: 'View',
      submenu: this.#viewMenu,
    }), 2);
    return this.#viewMenu;
  }

  protected createAssistantsMenu() {
    if (this.#assistantsMenu)
      this.#assistantsMenu.destructor();
    const menuItem = gui.MenuItem.create({
      label: 'Assistants',
      submenu: [
        {
          label: 'Open Dashboard...',
          onClick: () => windowManager.showNamedWindow('dashboard'),
        },
        {
          label: 'New Assistant...',
          accelerator: 'Shift+CmdOrCtrl+N',
          onClick: () => windowManager.showNamedWindow('newAssistant'),
        },
        { type: 'separator' },
      ],
    });
    this.#assistantsMenu = new AssistantsMenu(menuItem.getSubmenu(), this.menu.itemCount(), null, (instance) => ({
      label: `Open ${instance.service.name}...`,
      onClick: () => windowManager.showChatWindow(instance.id),
    }));
    this.menu.insert(menuItem, this.menu.itemCount() - 1);
  }

  protected createAssistantsItemsInViewMenu() {
    if (this.#assistantsMenuInView)
      throw new Error('Assistant items already created');
    if (!this.#viewMenu)
      throw new Error('There is no View menu');
    const DashboardWindow = require('./dashboard-window').default;
    this.#viewMenu.append(gui.MenuItem.create('separator'));
    this.#assistantsMenuInView = new AssistantsMenu(this.#viewMenu, this.#viewMenu.itemCount(), 'CmdOrCtrl', (instance) => ({
      label: `Switch to ${instance.service.name}`,
      validate: () => windowManager.getCurrentWindow() instanceof DashboardWindow,
      onClick: () => {
        const win = windowManager.getCurrentWindow() as typeof DashboardWindow;
        if (win instanceof DashboardWindow)
          win.switchTo(win.views.findIndex(v => v.instance == instance));
      }
    }));
  }

  // Concatenate menu items of all registered views.
  protected getAllViewMenuItems() {
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
    return items;
  }

  // Wrap the menu items of |viewClass| by doing auto validation.
  protected getViewMenuItems(viewClass: BaseViewType) {
    if (!viewClass.getMenuItems)
      return null;
    const viewItems = viewClass.getMenuItems();
    if (viewItems.length == 0)
      return null;
    const validateAndGetView = () => {
      let view = windowManager.getCurrentWindow()?.getMainView();
      if (!view)
        return null;
      // Some view (like MultiChatsView) may have a main view inside it.
      if (view.getMainView() instanceof viewClass)
        view = view.getMainView();
      else if (!(view instanceof viewClass))
        return null;
      return view;
    };
    return viewItems.map(item => ({
      label: item.label,
      accelerator: item.accelerator,
      validate: () => {
        // First check if the current view matches the type.
        const view = validateAndGetView();
        if (!view)
          return false;
        // Then calling the original validate function.
        return item.validate ? item.validate(view) : true;
      },
      onClick: () => {
        if (item.onClick) {
          const view = validateAndGetView();
          if (view)
            item.onClick(view);
        }
      }
    }));
  }
}
