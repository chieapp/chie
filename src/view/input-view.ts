import gui from 'gui';
import IconButton, {buttonRadius} from './icon-button';
import {createRoundedCornerPath} from './util';

export default class InputView {
  view: gui.Container;
  entry: gui.TextEdit;
  buttonArea?: gui.Container;

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

  // Color of disabled TextEdit.
  static entryWrapperDisabledBgColor?: number;

  constructor() {
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
  }

  setText(text: string) {
    this.entry.setText(text);
    this.#adjustEntryHeight();
  }

  addButton(button: IconButton) {
    button.view.setStyle(InputView.buttonSize);
    this.buttonArea.addChildView(button.view);
  }

  #onDraw(view, painter: gui.Painter) {
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, 5);
    if (this.entry.isEnabled()) {
      painter.setFillColor('#FFF');
    } else {
      if (!InputView.entryWrapperDisabledBgColor)
        InputView.entryWrapperDisabledBgColor = gui.Color.get('disabled-text-edit-background');
      painter.setFillColor(InputView.entryWrapperDisabledBgColor);
    }
    painter.fill();
  }

  // Automatically changes the height of entry to show all of user's inputs.
  #adjustEntryHeight() {
    let height = this.entry.getTextBounds().height;
    if (height <= InputView.entryHeights.min) {
      this.buttonArea.setStyle({
        flexDirection: 'row',
        alignItems: 'center',
      });
    } else if (height <= InputView.buttonSize.height * this.buttonArea.childCount()) {
      this.buttonArea.setStyle({
        flexDirection: 'row',
        alignItems: 'flex-end',
      });
    } else {
      this.buttonArea.setStyle({
        flexDirection: 'column-reverse',
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
