import gui from 'gui';

import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import ChatView from './chat-view';
import ChatService from '../model/chat-service';
import InputView from './input-view';
import basicStyle from './basic-style';

export default class TextWindow extends BaseWindow {
  modes: 'show' | 'edit';
  service: ChatService;
  index: number;
  text: string;
  input: InputView;

  constructor(mode, service: ChatService, index: number, text: string) {
    super({pressEscToClose: true});
    this.mode = mode;
    this.service = service;
    this.index = index;
    this.text = text;

    this.contentView.setStyle({padding: basicStyle.padding});
    this.window.setTitle('Raw Message Text');
    this.window.setContentSize({width: 200, height: 300});

    this.input = new InputView();
    this.input.view.setStyle({flex: 1});
    this.input.entry.setFont(ChatView.font);
    this.input.entry.setText(text);
    this.contentView.addChildView(this.input.view);

    const buttonsArea = new ButtonsArea();
    this.contentView.addChildView(buttonsArea.view);

    if (this.mode == 'edit') {
      const updateButton = buttonsArea.addButton('Modify');
      updateButton.onClick = () => {
        service.updateMessage(index, {content: this.input.entry.getText()});
        this.window.close();
      };
    }
    const copyButton = buttonsArea.addButton('Copy');
    copyButton.onClick = () => gui.Clipboard.get().setText(this.input.entry.getText());
    buttonsArea.addCloseButton();

    // First button is default button.
    const defaultButton = buttonsArea.row.childAt(0) as gui.Button;
    defaultButton.makeDefault();
  }

  destructor() {
    super.destructor();
    this.input.destructor();
  }

  showWithWidth(textWidth: number) {
    // Get the insets between the input and window.
    const inputBounds = this.input.entry.getBounds();
    const contentBounds = this.contentView.getBounds();
    const insets = {
      x: contentBounds.width - inputBounds.width,
      y: contentBounds.height - inputBounds.height,
    };
    // Count the needed size for window.
    const workAreaHeight = gui.screen.getDisplayNearestWindow(this.window).workArea.height;
    const text = gui.AttributedText.create(this.text, {font: ChatView.font});
    const bounds = text.getBoundsFor({
      width: textWidth,
      height: workAreaHeight - insets.y - 100,
    });
    bounds.width += insets.x + 2;
    bounds.height += insets.y + 2;
    bounds.width = Math.max(400, bounds.width);
    bounds.height = Math.max(200, bounds.height);
    this.window.setContentSize(bounds);
    this.window.center();
    this.window.activate();
    this.input.entry.focus();
  }
}
