import MenuBar, {getWindowManager} from './menu-bar';
import MultiChatsView from './multi-chats-view';

export default class AppMenu extends MenuBar {
  constructor() {
    const template = [];

    // The main menu.
    template.push({
      label: require('../../package.json').build.productName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hide-others' },
        { role: 'unhide' },
        { type: 'separator' },
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
        { type: 'separator' },
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          validate: () => getCurrentMultiChatsView() != null,
          onClick: () => getCurrentMultiChatsView().service.createChat(),
        },
        {
          label: 'Show Previous Chat',
          accelerator: 'Ctrl+Shift+Tab',
          validate: () => getCurrentMultiChatsView()?.hasMultiChats(),
          onClick: () => getCurrentMultiChatsView().showPreviousChat(),
        },
        {
          label: 'Show Next Chat',
          accelerator: 'Ctrl+Tab',
          validate: () => getCurrentMultiChatsView()?.hasMultiChats(),
          onClick: () => getCurrentMultiChatsView().showNextChat(),
        },
        {
          label: 'Clear Chats',
          accelerator: 'Shift+Ctrl+C',
          validate: () => getCurrentMultiChatsView() != null,
          onClick: () => getCurrentMultiChatsView().service.clearChats(),
        },
      ],
    });

    super(template);
  }
}

function getCurrentMultiChatsView(): MultiChatsView | null {
  const view = getWindowManager().getCurrentWindow()?.getMainView();
  if (view instanceof MultiChatsView)
    return view;
  return null;
}
