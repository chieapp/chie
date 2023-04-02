import gui from 'gui';
import IconButton, {buttonRadius} from './icon-button';
import {createRoundedCornerPath} from './util';
import SignalsOwner from '../model/signals-owner';

const inputBorderRadius = 5;

export default class InputView extends SignalsOwner {
  view: gui.Container;
  entry: gui.TextEdit;
  buttonArea?: gui.Container;

  buttons: IconButton[] = [];

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  // Fixed button size.
  static buttonSize = {
    width: 16 + buttonRadius,
    height: 16 + buttonRadius,
  };

  // Color of TextEdit.
  static bgColor?: number;
  static disabledBgColor?: number;

  constructor() {
    super();

    this.view = gui.Container.create();
    if (process.platform == 'win32')
      this.view.setBackgroundColor('#E5E5E5');
    this.view.onDraw = this.#onDraw.bind(this);
    this.view.setStyle({
      flexDirection: 'row',  // horizontal layout
      alignItems: 'flex-end',  // buttons anchored to bottom
    });

    const entryWrapper = gui.Container.create();
    entryWrapper.setStyle({
      height: '100%',  // take full vertical space
      flex: 1,  // take full horizontal space
      flexDirection: 'row',  // horizontal layout
      alignItems: 'center',  // entry placed in vertical center
      paddingTop: 5,
      paddingBottom: 5,
    });
    this.view.addChildView(entryWrapper);

    this.entry = gui.TextEdit.create();
    this.entry.onTextChange = this.#adjustEntryHeight.bind(this);
    if (process.platform != 'win32') {
      // Force using overlay scrollbar.
      this.entry.setOverlayScrollbar(true);
      this.entry.setScrollbarPolicy('never', 'automatic');
    }
    // Font size should be the same with messages.
    const font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');
    this.entry.setFont(font);
    // Calculate height for 1 and 5 lines.
    if (!InputView.entryHeights) {
      this.entry.setText('1');
      const min = this.entry.getTextBounds().height;
      this.entry.setText('1\n2\n3\n4\n5');
      const max = this.entry.getTextBounds().height;
      this.entry.setText('');
      InputView.entryHeights = {min, max};
    }
    this.entry.setStyle({
      flex: 1,  // take full horizontal space
      height: InputView.entryHeights.min,  // default to 1 line height
      marginLeft: inputBorderRadius,
    });
    entryWrapper.addChildView(this.entry);

    this.buttonArea = gui.Container.create();
    this.buttonArea.setStyle({
      height: '100%',  // take full vertical space
      alignItems: 'center',  // entry placed in vertical center
      flexDirection: 'row',  // horizontal layout
      padding: 2,
    });
    this.view.addChildView(this.buttonArea);

    this.connectYueSignal(
      gui.appearance.onColorSchemeChange,
      this.#onColorSchemeChange.bind(this));
  }

  unload() {
    super.unload();
    for (const button of this.buttons)
      button.unload();
  }

  setText(text: string) {
    this.entry.setText(text);
    this.#adjustEntryHeight();
  }

  setEntryEnabled(enabled: boolean) {
    this.entry.setEnabled(enabled);
    this.view.schedulePaint();
  }

  addButton(button: IconButton) {
    button.view.setStyle(InputView.buttonSize);
    this.buttons.push(button);
    this.buttonArea.addChildView(button.view);
  }

  #onDraw(view, painter: gui.Painter) {
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, 5);
    if (this.entry.isEnabled()) {
      if (!InputView.bgColor)
        InputView.bgColor = gui.Color.get('text-edit-background');
      painter.setFillColor(InputView.bgColor);
    } else {
      if (!InputView.disabledBgColor)
        InputView.disabledBgColor = gui.Color.get('disabled-text-edit-background');
      painter.setFillColor(InputView.disabledBgColor);
    }
    painter.fill();
  }

  #onColorSchemeChange() {
    InputView.bgColor = null;
    InputView.disabledBgColor = null;
    this.view.schedulePaint();
  }

  // Automatically changes the height of entry to show all of user's inputs.
  #adjustEntryHeight() {
    let height = this.entry.getTextBounds().height;
    if (height <= InputView.entryHeights.min) {
      this.buttonArea.setStyle({
        flexDirection: 'row',
        alignItems: 'center',
      });
    } else {
      this.buttonArea.setStyle({
        flexDirection: 'row',
        alignItems: 'flex-end',
      });
    }
    if (height < InputView.entryHeights.min)
      height = InputView.entryHeights.min;
    else if (height > InputView.entryHeights.max)
      height = InputView.entryHeights.max;
    this.entry.setStyle({height});
  }
}
