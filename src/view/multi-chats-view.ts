import gui from 'gui';

import ChatListItem from './chat-list-item';
import ChatService from '../model/chat-service';
import ChatView from './chat-view';
import SignalsOwner from '../model/signals-owner';
import {ChatCompletionAPI} from '../model/chat-api';

export const style = {
  padding: 8,
  light: {
    columnBgColor: '#F5F5F5',
    activeItem: '#2D9EE0',
    activeItemText: '#FFFFFF',
    hoverItem: '#E8E8E8',
    textColor: '#1A1A1A',
  },
  dark: {
    columnBgColor: '#333333',
    activeItem: '#2D9EE0',
    activeItemText: '#FFFFFF',
    hoverItem: '#3F3F3F',
    textColor: '#F8F8FA',
  },
};

export default class MultiChatsView extends SignalsOwner {
  name: string;
  api: ChatCompletionAPI;
  view: gui.Container;
  chatView: ChatView;
  selectedItem?: ChatListItem;

  draftService: ChatService;
  services: ChatService[] = [];

  #chatListScroll: gui.Scroll;
  #chatList: gui.Container;

  constructor(name: string, api: ChatCompletionAPI) {
    super();
    this.name = name;
    this.api = api;
    this.view = gui.Container.create();
    this.view.setStyle({flexDirection: 'row'});

    const sidebar = gui.Container.create();
    sidebar.setBackgroundColor(style.light.columnBgColor);
    sidebar.setStyle({width: 200});
    this.view.addChildView(sidebar);

    const button = gui.Button.create('New chat');
    button.setStyle({margin: style.padding});
    button.onClick = this.createChat.bind(this);
    sidebar.addChildView(button);

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
    sidebar.addChildView(this.#chatListScroll);

    this.#chatList = gui.Container.create();
    this.#chatListScroll.setContentView(this.#chatList);

    // Always create a new blank chat for the view.
    this.draftService = this.createChat();

    this.chatView = new ChatView(this.draftService);
    this.chatView.view.setStyle({flex: 1});
    this.view.addChildView(this.chatView.view);
  }

  unload() {
    super.unload();
    this.chatView.unload();
  }

  createChat() {
    const service = new ChatService(this.name, this.api);
    service.title = 'New chat';
    const item = new ChatListItem(service);
    item.setSelected(true);
    this.connections.add(item.onSelected.connect(this.#onSelectItem.bind(this)));
    if (this.selectedItem)
      this.selectedItem.setSelected(false);
    this.selectedItem = item;
    this.#chatList.addChildView(item.view);
    this.#chatListScroll.setContentSize({
      width: this.#chatListScroll.getBounds().width,
      height: this.#chatList.getPreferredSize().height,
    });
    return service;
  }

  #onSelectItem(item: ChatListItem) {
    if (this.selectedItem)
      this.selectedItem.setSelected(false);
    this.selectedItem = item;
  }
}
