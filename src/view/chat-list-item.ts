import gui from 'gui';
import {Signal} from 'typed-signals';
import AppearanceAware from '../model/appearance-aware';
import ChatService from '../model/chat-service';
import {createRoundedCornerPath} from './util';

import {style} from './multi-chats-view';

export default class ChatListItem extends AppearanceAware {
  service: ChatService;
  selected = false;
  hover = false;

  onSelected: Signal<(item: ChatListItem) => void> = new Signal;

  constructor(service: ChatService) {
    super();
    this.service = service;
    this.connections.add(service.onNewTitle.connect(this.#onNewTitle.bind(this)));
    this.view.setStyle({width: '100%', height: 30, marginBottom: 2});
    this.view.onDraw = this.#onDraw.bind(this);
    this.view.onMouseEnter = () => {
      this.hover = true;
      this.view.schedulePaint();
    };
    this.view.onMouseLeave = () => {
      this.hover = false;
      this.view.schedulePaint();
    };
    this.view.onMouseUp = () => {
      if (!this.selected) {
        this.setSelected(true);
        this.onSelected.emit(this);
      }
    };
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    this.view.schedulePaint();
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
      x: style.padding,
      y: 0,
      width: viewBounds.width - 2 * style.padding,
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
    // Text.
    bounds.x += style.padding;
    bounds.width -= style.padding;
    const color = this.selected ? theme.activeItemText : theme.textColor;
    painter.drawText(this.service.title, bounds, {valign: 'center', color});
  }
}
