import gui from 'gui';

import BaseMultiChatsService from '../model/base-multi-chats-service';
import ChatListItem from '../view/chat-list-item';
import ChatView from '../view/chat-view';
import SplitView, {SplitViewState, resizeHandleWidth} from '../view/split-view';
import basicStyle from '../view/basic-style';
import {config} from '../controller/configs';
import {collectGarbage} from '../controller/gc-center';

export const style = {
  light: {
    columnBgColor: '#F5F5F5',
    activeItem: basicStyle.accentColor,
    activeItemText: '#FFFFFF',
    hoverItem: '#E8E8E8',
    textColor: '#1A1A1A',
  },
  dark: {
    columnBgColor: '#333333',
    activeItem: basicStyle.accentColor,
    activeItemText: '#FFFFFF',
    hoverItem: '#3F3F3F',
    textColor: '#F8F8FA',
  },
};

export interface MultiChatsViewState extends SplitViewState {
  selected?: number;
}

export default class MultiChatsView extends SplitView<BaseMultiChatsService> {
  static getMenuItems() {
    return [
      {
        label: 'New Chat',
        accelerator: 'CmdOrCtrl+N',
        onClick: (view: MultiChatsView) => view.service.createChat(),
      },
      {
        label: 'Show Previous Chat',
        accelerator: 'CmdOrCtrl+[',
        validate: (view: MultiChatsView) => view.service.chats.length > 1,
        onClick: (view: MultiChatsView) => view.showPreviousChat(),
      },
      {
        label: 'Show Next Chat',
        accelerator: 'CmdOrCtrl+]',
        validate: (view: MultiChatsView) => view.service.chats.length > 1,
        onClick: (view: MultiChatsView) => view.showNextChat(),
      },
      {
        label: 'Clear Chats',
        onClick: (view: MultiChatsView) => view.service.clearChats(),
      },
    ];
  }

  static getSubViewType() {
    return ChatView;
  }

  chatView: ChatView;

  #items: ChatListItem[] = [];
  #selectedItem?: ChatListItem;

  #chatListScroll: gui.Scroll;
  #chatList: gui.Container;

  constructor(service: BaseMultiChatsService) {
    if (!(service instanceof BaseMultiChatsService))
      throw new Error('MultiChatsView can only be used with MultiChatsService');
    super(service);

    this.panel.setBackgroundColor(style.light.columnBgColor, style.dark.columnBgColor);

    // A scroll view with scrollbar hidden.
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
    this.#chatListScroll.setContentView(this.#chatList);
    this.addToPanel(this.#chatListScroll);

    // Use padding inside scroll instead of margin, so the scrollbar would show
    // in the empty space for better visual effect.
    this.#chatListScroll.setStyle({margin: 0});
    this.#chatList.setStyle({
      padding: basicStyle.padding,
      paddingRight: basicStyle.padding - resizeHandleWidth,
      paddingBottom: 0,
    });

    const button = gui.Button.create('New chat');
    if (process.platform == 'darwin')
      button.setControlSize('large');
    else
      button.setStyle({height: 28});
    button.onClick = service.createChat.bind(service);
    this.addToPanel(button);

    const clear = gui.Button.create('Clear chats');
    if (process.platform == 'darwin')
      clear.setControlSize('large');
    else
      clear.setStyle({height: 28});
    clear.setStyle({marginTop: 0});
    clear.onClick = service.clearChats.bind(service);
    this.addToPanel(clear);

    this.chatView = new ChatView();
    this.setMainView(this.chatView);
    this.connections.add(this.chatView.onNewTitle.connect(
      this.onNewTitle.emit.bind(this.onNewTitle)));

    // Load existing chats.
    for (const chat of service.chats) {
      const item = this.#createItemForChat(chat);
      this.#items.push(item);
      this.#chatList.addChildView(item.view);
    }
    if (this.#items.length > 0)
      this.#items[0].setSelected(true);
    this.connections.add(service.onNewChat.connect(this.#onNewChat.bind(this)));
    this.connections.add(service.onRemoveChat.connect(this.#onRemoveChat.bind(this)));
    this.connections.add(service.onClearChats.connect(this.#onClearChats.bind(this)));
  }

  destructor() {
    super.destructor();
    for (const item of this.#items)
      item.destructor();
  }

  initAsMainView() {
    if (this.service.chats.length == 0)
      this.service.createChat();
  }

  onResize() {
    // Update the size of chatList so it can fit to show all items.
    this.#chatListScroll.setContentSize({
      width: this.#chatListScroll.getBounds().width,
      height: this.#chatList.getPreferredSize().height,
    });
  }

  saveState(): MultiChatsViewState {
    return Object.assign(super.saveState(), {selected: this.#items.indexOf(this.#selectedItem)});
  }

  restoreState(state?: MultiChatsViewState) {
    super.restoreState(state);
    if (state?.selected)
      this.#items[state.selected]?.setSelected(true);
    // The bounds of views are not changed immediately, so delay update a
    // tick to wait for resize.
    setImmediate(() => this.onResize());
  }

  getTitle() {
    return this.mainView.getTitle() ?? this.service.name;
  }

  showPreviousChat() {
    const index = this.#items.indexOf(this.#selectedItem);
    if (index > -1)
      this.#items[(index - 1 + this.#items.length) % this.#items.length].setSelected(true);
  }

  showNextChat() {
    const index = this.#items.indexOf(this.#selectedItem);
    if (index > -1)
      this.#items[(index + 1) % this.#items.length].setSelected(true);
  }

  #createItemForChat(service) {
    // Create the list item.
    const item = new ChatListItem(service);
    // Link the item to this view.
    item.connections.add(item.onSelect.connect(this.#onSelectItem.bind(this)));
    item.connections.add(item.onClose.connect(this.#onCloseItem.bind(this)));
    return item;
  }

  async #onSelectItem(item: ChatListItem) {
    if (this.#selectedItem && this.#selectedItem != item)
      this.#selectedItem.setSelected(false);
    this.#selectedItem = item;
    await this.chatView.loadChatService(this.#selectedItem.service);
  }

  #onCloseItem(item: ChatListItem) {
    const index = this.#items.indexOf(item);
    if (index < 0)
      throw new Error('Closing an unexist chat.');
    this.service.removeChatAt(index);
  }

  #onNewChat(chat) {
    // Create item.
    const item = this.#createItemForChat(chat);
    this.#items.unshift(item);
    this.#chatList.addChildViewAt(item.view, 0);
    this.onResize();
    item.setSelected(true);
    config.saveToFile();
  }

  #onRemoveChat(index: number) {
    if (this.#items.length == 1)  // shortcut
      return this.#onClearChats();
    const item = this.#items[index];
    if (this.#selectedItem == item) {
      // If closed item is selected, move selection to siblings.
      if (index + 1 < this.#items.length)
        this.#items[index + 1].setSelected(true);
      else if (index > 0)
        this.#items[index - 1].setSelected(true);
    }
    this.#chatList.removeChildView(item.view);
    this.#items.splice(index, 1);
    this.onResize();
    item.destructor();
    config.saveToFile();
    collectGarbage();
  }

  #onClearChats() {
    for (const item of this.#items) {
      this.#chatList.removeChildView(item.view);
      item.destructor();
    }
    this.#items = [];
    this.#selectedItem = null;
    collectGarbage();
  }
}
