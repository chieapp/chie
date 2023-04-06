import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView from '../view/base-view';
import ChatListItem from './chat-list-item';
import ChatView from './chat-view';
import MultiChatsService from '../model/multi-chats-service';

export const style = {
  padding: 14,
  resizeHandleWidth: 6,
  light: {
    columnBgColor: '#F5F5F5',
    activeItem: '#00B386',
    activeItemText: '#FFFFFF',
    hoverItem: '#E8E8E8',
    textColor: '#1A1A1A',
  },
  dark: {
    columnBgColor: '#333333',
    activeItem: '#00B386',
    activeItemText: '#FFFFFF',
    hoverItem: '#3F3F3F',
    textColor: '#F8F8FA',
  },
};

export default class MultiChatsView extends BaseView<MultiChatsService> {
  static resizeCursor?: gui.Cursor;

  chatView: ChatView;

  #selectedItem?: ChatListItem;
  #items: ChatListItem[] = [];

  #leftPane: AppearanceAware;
  #sidebar: gui.Container;
  #chatListScroll: gui.Scroll;
  #chatList: gui.Container;
  #resizeHandle: gui.Container;

  constructor(service: MultiChatsService) {
    if (!(service instanceof MultiChatsService))
      throw new Error('MultiChatsView can only be used with MultiChatsService');
    super(service);

    this.view = gui.Container.create();
    this.view.setStyle({flexDirection: 'row'});

    this.#leftPane = new AppearanceAware();
    this.#leftPane.view.setStyle({flexDirection: 'row', width: 200});
    this.#leftPane.setBackgroundColor(style.light.columnBgColor, style.dark.columnBgColor);
    this.view.addChildView(this.#leftPane.view);

    this.#sidebar = gui.Container.create();
    this.#sidebar.setStyle({flex: 1});
    this.#leftPane.view.addChildView(this.#sidebar);

    this.#chatListScroll = gui.Scroll.create();
    this.#chatListScroll.setStyle({flex: 1});
    if (process.platform === 'win32') {
      // On Windows there is no overlay scrollbar.
      this.#chatListScroll.setScrollbarPolicy('never', 'never');
    } else {
      // Force using overlay scrollbar.
      this.#chatListScroll.setOverlayScrollbar(true);
      this.#chatListScroll.setScrollbarPolicy('never', 'automatic');
    }

    this.#chatList = gui.Container.create();
    this.#chatList.setStyle({
      padding: style.padding,
      paddingRight: style.padding - style.resizeHandleWidth,
    });
    this.#chatListScroll.setContentView(this.#chatList);
    this.#sidebar.addChildView(this.#chatListScroll);

    const button = gui.Button.create('New chat');
    button.setStyle({
      margin: style.padding,
      marginRight: style.padding - style.resizeHandleWidth,
    });
    button.onClick = this.createChat.bind(this);
    this.#sidebar.addChildView(button);

    const clear = gui.Button.create('Clear conversations');
    clear.setStyle({
      margin: style.padding,
      marginRight: style.padding - style.resizeHandleWidth,
      marginTop: 0,
    });
    clear.onClick = this.clearChats.bind(this);
    this.#sidebar.addChildView(clear);

    this.#resizeHandle = gui.Container.create();
    // The resize handle has the same background with sidebar, so it can not be
    // "seen", but if user trys to resize the sidebar, they will find it.
    this.#resizeHandle.setStyle({width: style.resizeHandleWidth});
    this.#resizeHandle.setMouseDownCanMoveWindow(false);
    if (!MultiChatsView.resizeCursor)
      MultiChatsView.resizeCursor = gui.Cursor.createWithType('resize-ew');
    this.#resizeHandle.setCursor(MultiChatsView.resizeCursor);
    this.#resizeHandle.onMouseMove = this.#onDragHandle.bind(this);
    this.#leftPane.view.addChildView(this.#resizeHandle);
  }

  destructor() {
    super.destructor();
    this.chatView.destructor();
    for (const item of this.#items)
      item.destructor();
    this.#leftPane.destructor();
  }

  initAsMainView() {
    this.createChat();
  }

  onFocus() {
    this.chatView.onFocus();
  }

  createChat() {
    // Create chat service.
    const service = this.service.createChat();
    service.title = 'New chat';

    // Create chat view lazily.
    if (!this.chatView) {
      this.chatView = new ChatView(service);
      this.chatView.view.setStyle({flex: 1});
      this.view.addChildView(this.chatView.view);
    }
    this.chatView.loadChatService(service);

    // Create the list item.
    const item = new ChatListItem(service);
    this.#items.unshift(item);
    this.#chatList.addChildViewAt(item.view, 0);
    this.#updateChatListSize();

    // Link the item to this view.
    item.connections.add(item.onSelect.connect(this.#onSelectItem.bind(this)));
    item.connections.add(item.onClose.connect(this.#onCloseItem.bind(this)));
    item.setSelected(true);
  }

  clearChats() {
    for (const item of this.#items) {
      this.#chatList.removeChildView(item.view);
      item.destructor();
    }
    this.#items = [];
    this.service.clearChats();
    this.createChat();
  }

  #onSelectItem(item: ChatListItem) {
    if (this.#selectedItem)
      this.#selectedItem.setSelected(false);
    this.#selectedItem = item;
    this.chatView.loadChatService(this.#selectedItem.service);
  }

  #onCloseItem(item: ChatListItem) {
    const index = this.#items.indexOf(item);
    if (index < 0)
      throw new Error('Closing an unexist chat.');
    if (this.#selectedItem == item) {
      // If closed item is selected, move selection to siblings.
      if (index + 1 < this.#items.length)
        this.#items[index + 1].setSelected(true);
      else if (index > 0)
        this.#items[index - 1].setSelected(true);
    }
    this.#chatList.removeChildView(item.view);
    this.#items.splice(index, 1);
    this.service.removeChatAt(index);
    item.destructor();
    // Always have a chat available.
    if (this.#items.length == 0)
      this.createChat();
    else
      this.#updateChatListSize();
  }

  #onDragHandle(view, event) {
    const max = this.view.getBounds().width - 100;
    const width = Math.floor(Math.min(max, Math.max(180, event.positionInWindow.x)));
    this.#leftPane.view.setStyle({width});
    // The scroll view does not shrink content size automatically.
    this.#updateChatListSize();
  }

  // Update the size of chatList so it can fit to show all items.
  #updateChatListSize() {
    this.#chatListScroll.setContentSize({
      width: this.#chatListScroll.getBounds().width,
      height: this.#chatList.getPreferredSize().height,
    });
  }
}
