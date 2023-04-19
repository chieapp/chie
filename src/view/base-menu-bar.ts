import gui from 'gui';

import AssistantsMenu from './assistants-menu';
import SignalsOwner from '../model/signals-owner';
import {BaseViewType} from './base-view';

export default class BaseMenuBar extends SignalsOwner {
  static fileMenuItems = [
    {
      label: 'Settings...',
      accelerator: 'CmdOrCtrl+,',
      onClick() { getWindowManager().showNamedWindow('settings'); },
    },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      onClick() { getWindowManager().quit(); },
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
    this.#assistantsMenu?.destructor();
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
          accelerator: 'Shift+CmdOrCtrl+D',
          onClick: () => getWindowManager().showNamedWindow('dashboard'),
        },
        {
          label: 'New Assistant...',
          accelerator: 'Shift+CmdOrCtrl+N',
          onClick: () => getWindowManager().showNamedWindow('newAssistant'),
        },
        { type: 'separator' },
      ],
    });
    this.#assistantsMenu = new AssistantsMenu(menuItem.getSubmenu(), -1, (instance, index) => ({
      label: `Open ${instance.service.name}...`,
      accelerator: `Alt+CmdOrCtrl+${index + 1}`,
      onClick: () => getWindowManager().showChatWindow(instance),
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
    this.#assistantsMenuInView = new AssistantsMenu(this.#viewMenu, -1, (instance, index) => ({
      label: `Switch to ${instance.service.name}...`,
      accelerator: `CmdOrCtrl+${index + 1}`,
      validate: () => getWindowManager().getCurrentWindow() instanceof DashboardWindow,
      onClick: () => {
        const win = getWindowManager().getCurrentWindow();
        if (win instanceof DashboardWindow)
          (win as typeof DashboardWindow).switchTo(index);
      }
    }));
  }

  // Wrap the menu items of |viewType| by doing auto validation.
  protected getViewMenuItems(viewType: BaseViewType) {
    if (!viewType.getMenuItems)
      return null;
    const viewItems = viewType.getMenuItems();
    if (viewItems.length == 0)
      return null;
    const validateAndGetView = () => {
      let view = getWindowManager().getCurrentWindow()?.getMainView();
      if (!view)
        return null;
      // Some view (like MultiChatsView) may have a main view inside it.
      if (view.getMainView() instanceof viewType)
        view = view.getMainView();
      else if (!(view instanceof viewType))
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

export function getWindowManager() {
  // Delay loaded to avoid circular reference.
  return require('../controller/window-manager').default;
}
