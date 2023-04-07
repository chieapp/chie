import gui from 'gui';
import ChatView from './chat-view';
import InputView from './input-view';
import SignalsOwner from '../model/signals-owner';

export default class TextWindow extends SignalsOwner {
  text: string;
  window: gui.Window;
  input: InputView;
  copyButton: gui.Button;

  constructor(text: string) {
    super();
    this.text = text;

    this.window = gui.Window.create({});
    this.window.setTitle('Raw Message Text');
    this.window.setContentSize({width: 200, height: 300});
    // Release resources on close.
    this.window.onClose = () => this.destructor();
    // Press ESC to close window.
    this.window.onKeyUp = (window, event) => {
      if (event.key == 'Escape')
        this.window.close();
    };

    const contentView = gui.Container.create();
    this.window.setContentView(contentView);

    this.input = new InputView();
    this.input.view.setStyle({flex: 1, margin: 10});
    this.input.entry.setFont(ChatView.font);
    this.input.entry.setText(text);
    contentView.addChildView(this.input.view);

    const buttonsArea = gui.Container.create();
    buttonsArea.setStyle({
      flexDirection: 'row-reverse',
      padding: 10,
      paddingTop: 0,
    });
    contentView.addChildView(buttonsArea);

    const closeButton = gui.Button.create('Close');
    closeButton.setStyle({width: 80, height: 28});
    closeButton.onClick = () => this.window.close();
    buttonsArea.addChildView(closeButton);

    this.copyButton = gui.Button.create('Copy');
    this.copyButton.onClick = () => gui.Clipboard.get().setText(this.input.entry.getText());
    this.copyButton.makeDefault();
    this.copyButton.setStyle({width: 80, height: 28, marginRight: 10});
    buttonsArea.addChildView(this.copyButton);
  }

  destructor() {
    this.input.destructor();
  }

  showAt(textBounds: gui.RectF) {
    // Get the insets between the input and window.
    const inputBounds = this.input.entry.getBounds();
    const contentBounds = this.window.getContentView().getBounds();
    const insets = {
      x: contentBounds.width - inputBounds.width,
      y: contentBounds.height - inputBounds.height,
    };
    // Count the needed size for window.
    const workAreaHeight = gui.screen.getDisplayNearestWindow(this.window).workArea.height;
    const text = gui.AttributedText.create(this.text, {font: ChatView.font});
    const bounds = text.getBoundsFor({
      width: textBounds.width,
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
