import gui from 'gui';

import BaseChatService from '../model/base-chat-service';
import BaseWindow from '../view/base-window';
import ButtonsArea from '../view/buttons-area';
import ChatView from '../view/chat-view';
import InputView from '../view/input-view';
import basicStyle from '../view/basic-style';

export default class TextWindow extends BaseWindow {
  mode: 'prompt' | 'show' | 'edit' | 'regenerate' | 'edit-regenerate';
  text: string;
  service?: BaseChatService;
  index?: number;

  input: InputView;
  defaultButton: gui.Button;

  constructor(mode, text: string, index?: number, service?: BaseChatService) {
    super({pressEscToClose: true});
    this.mode = mode;
    this.text = text;
    this.index = index;
    this.service = service;

    this.contentView.setStyle({
      padding: basicStyle.padding,
      gap: basicStyle.padding,
    });
    this.window.setTitle('Raw Message Text');
    this.window.setContentSize({width: 200, height: 300});

    this.input = new InputView();
    this.input.view.setStyle({flex: 1});
    this.input.entry.setFont(ChatView.font);
    this.input.entry.setText(text);
    this.contentView.addChildView(this.input.view);

    const buttonsArea = new ButtonsArea();
    this.contentView.addChildView(buttonsArea.view);

    if (this.mode.startsWith('edit')) {
      buttonsArea.addButton('Modify').onClick = () => {
        service.updateMessage({content: this.input.entry.getText()}, index);
        this.window.close();
      };
    }
    if (this.mode.endsWith('regenerate')) {
      buttonsArea.addButton('Modify and Regenerate').onClick = () => {
        service.updateMessage({content: this.input.entry.getText()}, index);
        service.regenerateFrom(index + 1);
        this.window.close();
      };
    }
    if (this.mode == 'prompt') {
      buttonsArea.addButton('OK');
    } else {
      buttonsArea.addButton('Copy').onClick = () => {
        gui.Clipboard.get().setText(this.input.entry.getText());
      };
    }
    buttonsArea.addCloseButton();

    // First button is default button.
    this.defaultButton = buttonsArea.row.childAt(0) as gui.Button;
    this.defaultButton.makeDefault();
  }

  destructor() {
    super.destructor();
    this.input.destructor();
  }

  showWithWidth(textWidth: number, options: {minWidth?: number, minHeight?: number} = {}) {
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
    bounds.width = Math.max(options?.minWidth ?? 460, bounds.width);
    bounds.height = Math.max(options?.minHeight ?? 200, bounds.height);
    this.window.setContentSize(bounds);
    this.window.center();
    this.window.activate();
    this.input.entry.focus();
  }
}
