import gui from 'gui';
import {Signal} from 'typed-signals';
import AppearanceAware from '../view/appearance-aware';
import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import {createRoundedCornerPath} from '../util/draw-utils';

import {style} from './multi-chats-view';

export default class ChatListItem extends AppearanceAware {
  service: ChatService;

  onSelect: Signal<(item: ChatListItem) => void> = new Signal;
  onClose: Signal<(item: ChatListItem) => void> = new Signal;

  closeButton: IconButton;

  selected = false;
  hover = false;

  title: string;
  #titleText: gui.AttributedText;
  #titleBounds: gui.RectF;

  constructor(service: ChatService) {
    super();
    this.service = service;
    this.connections.add(service.onNewTitle.connect(this.setTitle.bind(this)));
    this.view.setMouseDownCanMoveWindow(false);
    this.view.setStyle({width: '100%', height: 32, marginBottom: 2});
    this.view.onDraw = this.#onDraw.bind(this);
    this.view.onMouseEnter = () => {
      this.hover = true;
      this.closeButton.view.setVisible(true);
      this.view.schedulePaint();
    };
    this.view.onMouseLeave = () => {
      this.hover = false;
      this.closeButton.view.setVisible(false);
      this.view.schedulePaint();
    };
    this.view.onMouseUp = () => {
      if (!this.selected)
        this.setSelected(true);
    };
    this.view.onSizeChanged = this.#updateTooltip.bind(this);

    this.view.setStyle({
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingRight: 5,
    });
    this.closeButton = new IconButton('stop');
    this.closeButton.view.setTooltip('Close chat');
    this.closeButton.view.setVisible(false);
    this.closeButton.onClick = () => this.onClose.emit(this);
    this.view.addChildView(this.closeButton.view);

    this.setTitle(this.service.title);
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    if (selected)
      this.onSelect.emit(this);
    this.closeButton.colorMode = selected ? 'dark' : null;
    this.setTitle(this.title);  // update title color
    this.view.schedulePaint();
  }

  setTitle(title: string | null) {
    this.title = title ?? 'New chat';
    const theme = this.darkMode ? style.dark : style.light;
    this.#titleText = gui.AttributedText.create(this.title, {
      valign: 'center',
      ellipsis: true,
      // In GTK ellipsis stops working with wrap=true.
      wrap: process.platform == 'linux',
      color: this.selected ? theme.activeItemText : theme.textColor,
    });
    this.#titleBounds = this.#titleText.getBoundsFor({width: 10000, height: 1000});
    this.#updateTooltip();
    this.view.schedulePaint();
  }

  #updateTooltip() {
    const bounds = Object.assign(this.view.getBounds(), {x: 0, y: 0});
    // Always consider space for the close button since the tooltip only shows
    // when mouse is hovering on it.
    bounds.width -= this.closeButton.view.getBounds().width + style.padding;
    // Only show tooltip when there is not enough room to show the title.
    if ((bounds.width -= 2 * style.padding) < this.#titleBounds.width)
      this.view.setTooltip(this.title);
    else
      this.view.setTooltip('');
  }

  #onDraw(view, painter: gui.Painter) {
    // Background color.
    const theme = this.darkMode ? style.dark : style.light;
    if (this.selected)
      painter.setFillColor(theme.activeItem);
    else if (this.hover)
      painter.setFillColor(theme.hoverItem);
    else
      painter.setFillColor(theme.columnBgColor);
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, 5);
    painter.fill();
    // Avoid overlapping the buttons.
    if (this.hover)
      bounds.width = this.closeButton.view.getBounds().x;
    // Leave paddings for text.
    bounds.x += style.padding;
    bounds.width -= style.padding * 2;
    painter.drawAttributedText(this.#titleText, bounds);
  }
}
