import gui from 'gui';
import {Signal} from 'typed-signals';
import AppearanceAware from '../model/appearance-aware';
import ChatView from './chat-view';
import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import {createRoundedCornerPath} from './util';

import {style} from './multi-chats-view';

export default class ChatListItem extends AppearanceAware {
  service: ChatService;

  onSelect: Signal<(item: ChatListItem) => void> = new Signal;
  onClose: Signal<(item: ChatListItem) => void> = new Signal;

  closeButton: IconButton;
  menuButton: IconButton;

  selected = false;
  hover = false;

  constructor(service: ChatService) {
    super();
    this.service = service;
    this.connections.add(service.onNewTitle.connect(this.#onNewTitle.bind(this)));
    this.view.setStyle({width: '100%', height: 32, marginBottom: 2});
    this.view.onDraw = this.#onDraw.bind(this);
    this.view.onMouseEnter = () => {
      this.hover = true;
      this.closeButton.view.setVisible(true);
      this.menuButton.view.setVisible(true);
      this.view.schedulePaint();
    };
    this.view.onMouseLeave = () => {
      this.hover = false;
      this.closeButton.view.setVisible(false);
      this.menuButton.view.setVisible(false);
      this.view.schedulePaint();
    };
    this.view.onMouseUp = () => {
      if (!this.selected)
        this.setSelected(true);
    };

    this.view.setStyle({
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingRight: 5,
    });
    this.closeButton = this.#createButton('stop');
    this.closeButton.onClick = () => this.onClose.emit(this);
    this.menuButton = this.#createButton('menu');
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    if (selected)
      this.onSelect.emit(this);
    this.closeButton.colorMode = selected ? 'dark' : null;
    this.menuButton.colorMode = selected ? 'dark' : null;
    this.view.schedulePaint();
  }

  #createButton(image: string) {
    const button = new IconButton(image);
    button.view.setVisible(false);
    this.view.addChildView(button.view);
    return button;
  }

  #onNewTitle(title: string | null) {
    if (!title)
      this.service.title = 'New chat';
    this.view.schedulePaint();
  }

  #onDraw(view, painter: gui.Painter) {
    const theme = this.darkMode ? style.dark : style.light;
    // Leave padding on left and right.
    const viewBounds = view.getBounds();
    const bounds = {
      x: 0,
      y: 0,
      width: viewBounds.width,
      height: viewBounds.height,
    };
    // Background color.
    if (this.selected)
      painter.setFillColor(theme.activeItem);
    else if (this.hover)
      painter.setFillColor(theme.hoverItem);
    else
      painter.setFillColor(theme.columnBgColor);
    createRoundedCornerPath(painter, bounds, 5);
    painter.fill();
    // Avoid overlapping the buttons.
    if (this.hover)
      bounds.width = this.menuButton.view.getBounds().x;
    // Leave paddings for text.
    bounds.x += style.padding;
    bounds.width -= style.padding * 2;
    const color = this.selected ? theme.activeItemText : theme.textColor;
    painter.drawText(this.service.title, bounds, {valign: 'center', wrap: false, ellipsis: true, color});
  }
}
