import gui from 'gui';
import {Signal} from 'typed-signals';

import ChatService from '../model/chat-service';
import Clickable from './clickable';
import IconButton from './icon-button';
import basicStyle from './basic-style';
import prompt from '../util/prompt';
import {createRoundedCornerPath} from '../util/draw-utils';
import {style} from './multi-chats-view';

export default class ChatListItem extends Clickable {
  onSelect: Signal<(item: ChatListItem) => void> = new Signal;
  onClose: Signal<(item: ChatListItem) => void> = new Signal;

  service: ChatService;
  closeButton: IconButton;

  selected = false;

  title: string;
  #titleText: gui.AttributedText;
  #titleBounds: gui.RectF;

  constructor(service: ChatService) {
    super();
    this.service = service;

    this.view.setStyle({width: '100%', height: 32, marginBottom: 2});
    this.view.onMouseEnter = () => this.closeButton.view.setVisible(true);
    this.view.onMouseLeave = () => this.closeButton.view.setVisible(false);
    this.view.onSizeChanged = this.#updateTooltip.bind(this);
    this.onClick = () => this.setSelected(true);
    this.onContextMenu = () => this.runMenu();

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

    this.service.load().then(() => this.setTitle(service.getTitle()));
    this.connections.add(service.onNewTitle.connect(this.setTitle.bind(this)));
  }

  destructor() {
    super.destructor();
    this.closeButton.destructor();
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    if (selected)
      this.onSelect.emit(this);
    this.closeButton.colorMode = selected ? 'dark' : null;
    this.closeButton.view.schedulePaint();
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

  runMenu() {
    const menu = gui.Menu.create([
      {
        label: 'Edit title...',
        onClick: async () => {
          const title = await prompt('Edit Title', this.title);
          if (title)
            this.service.setCustomTitle(title);
        },
      },
      {
        label: 'Close',
        onClick: () => this.onClose.emit(this),
      },
    ]);
    menu.popup();
  }

  onColorSchemeChange() {
    super.onColorSchemeChange();
    this.setTitle(this.title);  // update text color.
  }

  onDraw(view, painter: gui.Painter) {
    if (!this.#titleText)  // no title set yet
      return;
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
    bounds.x += basicStyle.padding;
    bounds.width -= basicStyle.padding * 2;
    painter.drawAttributedText(this.#titleText, bounds);
  }

  #updateTooltip() {
    if (!this.#titleText)  // no title set yet
      return;
    const bounds = Object.assign(this.view.getBounds(), {x: 0, y: 0});
    // Always consider space for the close button since the tooltip only shows
    // when mouse is hovering on it.
    bounds.width -= this.closeButton.view.getBounds().width + basicStyle.padding;
    // Only show tooltip when there is not enough room to show the title.
    if ((bounds.width -= 2 * basicStyle.padding) < this.#titleBounds.width)
      this.view.setTooltip(this.title);
    else
      this.view.setTooltip('');
  }
}
