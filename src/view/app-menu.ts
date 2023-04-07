import gui from 'gui';
import BaseWindow from './base-window';
import ChatWindow from './chat-window';
import MultiChatsView from './multi-chats-view';

export default class AppMenu {
  window?: BaseWindow;
  menu: gui.MenuBar;

  constructor(win?: BaseWindow) {
    this.window = win;

    const template = [];

    // The main menu.
    if (!win) {
      template.push({
        label: require('../../package.json').build.productName,
        submenu: [
          {
            label: 'Quit',
            accelerator: 'CmdOrCtrl+Q',
            onClick() {
              if (gui.MessageLoop.quit)
                gui.MessageLoop.quit();
              process.exit(0);
            }
          },
        ],
      });
    }

    // Edit menu.
    template.push({
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
    });

    // Windows menu.
    template.push({
      label: 'Window',
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'maximize' },
        { role: 'close-window' },
        { type: 'separator' },
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          validate: () => this.getCurrentMultiChatsView() != null,
          onClick: () => this.getCurrentMultiChatsView()?.createChat(),
        },
        {
          label: 'Show Previous Chat',
          accelerator: 'Ctrl+Shift+Tab',
          validate: () => this.getCurrentMultiChatsView()?.hasMultiChats(),
          onClick: () => this.getCurrentMultiChatsView()?.showPreviousChat(),
        },
        {
          label: 'Show Next Chat',
          accelerator: 'Ctrl+Tab',
          validate: () => this.getCurrentMultiChatsView()?.hasMultiChats(),
          onClick: () => this.getCurrentMultiChatsView()?.showNextChat(),
        },
      ],
    });

    // Create the native menu.
    this.menu = gui.MenuBar.create(template);
  }

  getCurrentWindow(): BaseWindow | null {
    const windowManager = require('../controller/window-manager').default;
    return this.window ?? windowManager.getCurrentWindow();
  }

  getCurrentMultiChatsView(): MultiChatsView | null {
    const win = this.getCurrentWindow();
    if (!(win instanceof ChatWindow))
      return null;
    const view = win.chatView;
    if (!(view instanceof MultiChatsView))
      return null;
    return view;
  }
}
