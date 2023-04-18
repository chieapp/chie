import BaseWindow from './base-window';
import MenuBar from './menu-bar';
import MultiChatsView from './multi-chats-view';

export default class WindowMenu extends MenuBar {
  constructor(win: BaseWindow) {
    const template = [];

    // File menu.
    template.push({
      label: 'File',
      submenu: [
        MenuBar.quitMenuItem,
      ],
    });

    // Edit menu.
    template.push(MenuBar.editMenu);

    // Assistants menu.
    template.push(MenuBar.assistantsMenu);

    // Windows menu.
    template.push({
      label: 'Window',
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'maximize' },
        { role: 'close-window' },
      ],
    });

    const view = win.getMainView();
    if (view instanceof MultiChatsView) {
      template[template.length - 1].submenu.push(
        { type: 'separator' },
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          onClick: () => view.service.createChat(),
        },
        {
          label: 'Show Previous Chat',
          accelerator: 'Ctrl+Shift+Tab',
          onClick: () => view.showPreviousChat(),
        },
        {
          label: 'Show Next Chat',
          accelerator: 'Ctrl+Tab',
          onClick: () => view.showNextChat(),
        },
        {
          label: 'Clear Chats',
          accelerator: 'Shift+Ctrl+C',
          onClick: () => view.service.clearChats(),
        },
      );
    }

    super(template);
  }
}
