import gui from 'gui';

import AppearanceAware from '../model/appearance-aware';
import ChatListItem from './chat-list-item';
import ChatService from '../model/chat-service';
import ChatView from './chat-view';
import {ChatCompletionAPI} from '../model/chat-api';

export const style = {
  padding: 12,
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

export default class MultiChatsView extends AppearanceAware {
  name: string;
  api: ChatCompletionAPI;
  view: gui.Container;
  chatView: ChatView;

  #selectedItem?: ChatListItem;
  #items: ChatListItem[] = [];

  #sidebar: AppearanceAware;
  #chatListScroll: gui.Scroll;
  #chatList: gui.Container;
  #bar: gui.Container;

  constructor(name: string, api: ChatCompletionAPI) {
    if (!(api instanceof ChatCompletionAPI))
      throw new Error('MultiChatsView can only be used with ChatCompletionAPI');

    super();
    this.name = name;
    this.api = api;
    this.view = gui.Container.create();
    this.view.setStyle({flexDirection: 'row'});

    this.#sidebar = new AppearanceAware();
    this.#sidebar.setBackgroundColor(style.light.columnBgColor, style.dark.columnBgColor);
    this.#sidebar.view.setStyle({width: 200});
    this.view.addChildView(this.#sidebar.view);

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
    this.#chatList.setStyle({padding: style.padding});
    this.#chatListScroll.setContentView(this.#chatList);
    this.#sidebar.view.addChildView(this.#chatListScroll);

    const button = gui.Button.create('New chat');
    button.setStyle({margin: style.padding});
    button.onClick = this.createChat.bind(this);
    this.#sidebar.view.addChildView(button);

    const clear = gui.Button.create('Clear conversations');
    clear.setStyle({margin: style.padding, marginTop: 0});
    clear.onClick = this.clearChats.bind(this);
    this.#sidebar.view.addChildView(clear);

    this.chatView = new ChatView();
    this.chatView.view.setStyle({flex: 1});
    this.view.addChildView(this.chatView.view);

    // Always create a new blank chat for the view.
    this.createChat();
  }

  destructor() {
    super.destructor();
    this.chatView.destructor();
    for (const item of this.#items)
      item.destructor();
    this.#sidebar.destructor();
  }

  createChat() {
    // Create chat service.
    const service = new ChatService(this.name, this.api);
    service.title = 'New chat';
    this.chatView.loadChatService(service);

    // Create the list item.
    const item = new ChatListItem(service);
    this.#items.unshift(item);
    this.#chatList.addChildViewAt(item.view, 0);

    // Link the item to this view.
    item.connections.add(item.onSelect.connect(this.#onSelectItem.bind(this)));
    item.connections.add(item.onClose.connect(this.#onCloseItem.bind(this)));
    item.setSelected(true);

    // The content view must be manually resize.
    this.#chatListScroll.setContentSize({
      width: this.#chatListScroll.getBounds().width,
      height: this.#chatList.getPreferredSize().height,
    });
    return service;
  }

  clearChats() {
    for (const item of this.#items) {
      this.#chatList.removeChildView(item.view);
      item.destructor();
    }
    this.#items = [];
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
      if (index + 1 < this.#items.length)
        this.#items[index + 1].setSelected(true);
      else if (index > 0)
        this.#items[index - 1].setSelected(true);
    }
    this.#chatList.removeChildView(item.view);
    this.#items.splice(index, 1);
    item.destructor();
    if (this.#items.length == 0)
      this.createChat();
  }
}
