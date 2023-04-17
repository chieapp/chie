import gui from 'gui';

import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import ChatView from './chat-view';
import InputView from './input-view';
import {style} from './browser-view';

export default class TextWindow extends BaseWindow {
  text: string;
  input: InputView;
  copyButton: gui.Button;

  constructor(text: string) {
    super({pressEscToClose: true});
    this.text = text;

    this.contentView.setStyle({padding: style.padding});
    this.window.setTitle('Raw Message Text');
    this.window.setContentSize({width: 200, height: 300});

    this.input = new InputView();
    this.input.view.setStyle({flex: 1});
    this.input.entry.setFont(ChatView.font);
    this.input.entry.setText(text);
    this.contentView.addChildView(this.input.view);

    const buttonsArea = new ButtonsArea();
    this.contentView.addChildView(buttonsArea.view);
    this.copyButton = buttonsArea.addButton('Copy');
    this.copyButton.onClick = () => gui.Clipboard.get().setText(this.input.entry.getText());
    this.copyButton.makeDefault();
    buttonsArea.addCloseButton();
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
    this.window.setContentSize(bounds);
    this.window.center();
    this.window.activate();
    this.copyButton.focus();
  }
}
