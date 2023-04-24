import gui from 'gui';
import AppearanceAware from '../view/appearance-aware';
import IconButton from './icon-button';
import {createRoundedCornerPath} from '../util/draw-utils';

export default class InputView extends AppearanceAware {
  autoResize?: {min: number, max: number};

  entry: gui.TextEdit;
  buttons: IconButton[] = [];
  buttonsArea?: gui.Container;

  // Color of TextEdit.
  // Note that while it is tempting to do a global cache of the colors, it would
  // be hard to update the cache when window is not opened.
  bgColor?: number;
  disabledBgColor?: number;

  constructor() {
    super();

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
      padding: 5,
    });
    this.view.addChildView(entryWrapper);

    this.entry = gui.TextEdit.create();
    if (process.platform != 'win32') {
      // Force using overlay scrollbar.
      this.entry.setOverlayScrollbar(true);
      this.entry.setScrollbarPolicy('never', 'automatic');
    }
    this.entry.setStyle({
      flex: 1,  // take full horizontal space
      height: '100%',  // take full vertical space
    });
    entryWrapper.addChildView(this.entry);
  }

  destructor() {
    super.destructor();
    for (const button of this.buttons)
      button.destructor();
  }

  onColorSchemeChange() {
    super.onColorSchemeChange();
    this.bgColor = null;
    this.disabledBgColor = null;
  }

  setAutoResize(autoResize: {min: number, max: number}) {
    if (!this.autoResize)
      this.entry.onTextChange = this.#adjustEntryHeight.bind(this);
    this.autoResize = autoResize;
    this.entry.setStyle({height: autoResize.min});
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
    if (!this.buttonsArea) {
      this.buttonsArea = gui.Container.create();
      this.buttonsArea.setStyle({
        height: '100%',  // take full vertical space
        alignItems: 'flex-end',  // buttons aligned to bottom
        flexDirection: 'row',  // horizontal layout
        margin: 4,
        marginLeft: 0,
      });
      this.view.addChildView(this.buttonsArea);
    }
    this.buttons.push(button);
    this.buttonsArea.addChildView(button.view);
  }

  #onDraw(view, painter: gui.Painter) {
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, 5);
    if (this.entry.isEnabled()) {
      if (!this.bgColor)
        this.bgColor = gui.Color.get('text-edit-background');
      painter.setFillColor(this.bgColor);
    } else {
      if (!this.disabledBgColor)
        this.disabledBgColor = gui.Color.get('disabled-text-edit-background');
      painter.setFillColor(this.disabledBgColor);
    }
    painter.fill();
  }

  // Automatically changes the height of entry to show all of user's inputs.
  #adjustEntryHeight() {
    let height = this.entry.getTextBounds().height;
    height = Math.max(height, this.autoResize.min);
    height = Math.min(height, this.autoResize.max);
    this.entry.setStyle({height});
  }
}
