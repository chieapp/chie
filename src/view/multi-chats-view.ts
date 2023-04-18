import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView, {ViewState} from '../view/base-view';
import ChatListItem from './chat-list-item';
import ChatView from './chat-view';
import MultiChatsService from '../model/multi-chats-service';
import {config} from '../controller/config-store';
import {collectGarbage} from '../controller/gc-center';

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

export interface SplitViewState extends ViewState {
  leftPaneWidth?: number;
  selected?: number;
}

export default class MultiChatsView extends BaseView<MultiChatsService> {
  static resizeCursor?: gui.Cursor;

  chatView: ChatView;

  #items: ChatListItem[] = [];
  #selectedItem?: ChatListItem;

  #leftPane: AppearanceAware;
  #sidebar: gui.Container;
  #chatListScroll: gui.Scroll;
  #chatList: gui.Container;

  #resizeHandle: gui.Container;
  #resizeOrigin?: {x: number, width: number};

  constructor(service: MultiChatsService) {
    if (!(service instanceof MultiChatsService))
      throw new Error('MultiChatsView can only be used with MultiChatsService');
    super(service);

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
      paddingBottom: 0,
    });
    this.#chatListScroll.setContentView(this.#chatList);
    this.#sidebar.addChildView(this.#chatListScroll);

    const button = gui.Button.create('New chat');
    if (process.platform == 'darwin')
      button.setControlSize('large');
    else
      button.setStyle({height: 28});
    button.setStyle({
      margin: style.padding,
      marginRight: style.padding - style.resizeHandleWidth,
    });
    button.onClick = service.createChat.bind(service);
    this.#sidebar.addChildView(button);

    const clear = gui.Button.create('Clear chats');
    if (process.platform == 'darwin')
      clear.setControlSize('large');
    else
      clear.setStyle({height: 28});
    clear.setStyle({
      margin: style.padding,
      marginRight: style.padding - style.resizeHandleWidth,
      marginTop: 0,
    });
    clear.onClick = service.clearChats.bind(service);
    this.#sidebar.addChildView(clear);

    this.#resizeHandle = gui.Container.create();
    // The resize handle has the same background with sidebar, so it can not be
    // "seen", but if user trys to resize the sidebar, they will find it.
    this.#resizeHandle.setStyle({width: style.resizeHandleWidth});
    this.#resizeHandle.setMouseDownCanMoveWindow(false);
    if (!MultiChatsView.resizeCursor)
      MultiChatsView.resizeCursor = gui.Cursor.createWithType('resize-ew');
    this.#resizeHandle.setCursor(MultiChatsView.resizeCursor);
    this.#resizeHandle.onMouseDown = (view, event) => this.#resizeOrigin = {x: event.positionInWindow.x, width: this.#leftPane.view.getBounds().width};
    this.#resizeHandle.onMouseMove = this.#onDragHandle.bind(this);
    this.#resizeHandle.onMouseUp = () => this.#resizeOrigin = null;
    this.#leftPane.view.addChildView(this.#resizeHandle);

    this.chatView = new ChatView();
    this.chatView.view.setStyle({flex: 1});
    this.view.addChildView(this.chatView.view);
    this.connections.add(this.chatView.onNewTitle.connect(
      this.onNewTitle.emit.bind(this.onNewTitle)));

    // Load existing chats.
    for (const chat of service.chats) {
      const item = this.#createItemForChat(chat);
      this.#items.push(item);
      this.#chatList.addChildView(item.view);
    }
    if (this.#items.length > 0) {
      this.#items[0].setSelected(true);
      this.#updateChatListSize();
    }
    this.connections.add(service.onNewChat.connect(this.#onNewChat.bind(this)));
    this.connections.add(service.onRemoveChat.connect(this.#onRemoveChat.bind(this)));
    this.connections.add(service.onClearChats.connect(this.#onClearChats.bind(this)));
  }

  destructor() {
    super.destructor();
    this.chatView.destructor();
    for (const item of this.#items)
      item.destructor();
    this.#leftPane.destructor();
  }

  getMainView() {
    return this.chatView;
  }

  initAsMainView() {
    if (this.service.chats.length == 0)
      this.service.createChat();
  }

  onFocus() {
    this.chatView.onFocus();
  }

  saveState(): SplitViewState {
    return {
      leftPaneWidth: this.#leftPane.view.getBounds().width,
      selected: this.#items.indexOf(this.#selectedItem),
    };
  }

  restoreState(state?: SplitViewState) {
    if (state?.leftPaneWidth)
      this.#leftPane.view.setStyle({width: state.leftPaneWidth});
    if (state?.selected)
      this.#items[state.selected]?.setSelected(true);
    this.#updateChatListSize();
  }

  getTitle() {
    return this.chatView?.getTitle() ?? this.service.name;
  }

  getMainViewSize(): gui.SizeF {
    return this.chatView?.view.getBounds();
  }

  getSizeFromMainViewSize(size: gui.SizeF) {
    size.width += this.#leftPane.view.getBounds().width;
    return size;
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

  hasMultiChats() {
    return this.#items.length > 1;
  }

  #createItemForChat(service) {
    // Create the list item.
    const item = new ChatListItem(service);
    // Link the item to this view.
    item.connections.add(item.onSelect.connect(this.#onSelectItem.bind(this)));
    item.connections.add(item.onClose.connect(this.#onCloseItem.bind(this)));
    return item;
  }

  #onSelectItem(item: ChatListItem) {
    if (this.#selectedItem && this.#selectedItem != item)
      this.#selectedItem.setSelected(false);
    this.#selectedItem = item;
    this.chatView.loadChatService(this.#selectedItem.service);
    this.onNewTitle.emit();
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
    this.#updateChatListSize();
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
    this.#updateChatListSize();
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

  #onDragHandle(view, event) {
    if (!this.#resizeOrigin)
      return;
    const max = this.view.getBounds().width - 100;
    const width = Math.floor(Math.min(max, Math.max(100, event.positionInWindow.x - this.#resizeOrigin.x + this.#resizeOrigin.width)));
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
