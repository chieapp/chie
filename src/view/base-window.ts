import gui from 'gui';

import BaseView, {BaseViewType} from './base-view';
import SignalsOwner from '../model/signals-owner';
import WindowMenuBar from './window-menu-bar';
import windowManager from '../controller/window-manager';

export interface WindowState {
  bounds?: gui.RectF;
}

export interface BaseWindowOptions extends gui.WindowOptions {
  showMenuBar?: boolean;
  pressEscToClose?: boolean;
  viewType?: BaseViewType;
  // On modern macOS apps the NSVisualEffectView is usually used as the content
  // view, this option provides a way to disable it.
  useClassicBackground?: boolean;
}

export default class BaseWindow extends SignalsOwner {
  window: gui.Window;
  contentView: gui.Container;
  menuBar: WindowMenuBar;
  isClosed = false;

  constructor(options: BaseWindowOptions = {}) {
    super();

    this.window = gui.Window.create(options);
    if (process.platform == 'win32')
      this.window.setBackgroundColor('#F5F5F5');
    if (process.platform != 'darwin') {
      this.menuBar = new WindowMenuBar(this, options.viewType);
      this.window.setMenuBar(this.menuBar.menu);
      if (!options.showMenuBar)
        this.window.setMenuBarVisible(false);
    }

    if (options.pressEscToClose) {
      this.window.onKeyUp = (window, event) => {
        if (event.key == 'Escape')
          this.window.close();
      };
    }

    if (!options.useClassicBackground && process.platform == 'darwin') {
      const vibrant = gui.Vibrant.create();
      vibrant.setMaterial('window-background');
      this.contentView = vibrant;
    } else {
      this.contentView = gui.Container.create();
    }
    this.window.setContentView(this.contentView);

    windowManager.addWindow(this);
    this.window.onClose = () => {
      this.isClosed = true;
      this.destructor();
      windowManager.removeWindow(this);
    };
  }

  destructor() {
    super.destructor();
    this.menuBar?.destructor();
  }

  saveState(): WindowState | null {
    return {bounds: this.window.getBounds()};
  }

  restoreState(state: WindowState) {
    if (state.bounds) {
      this.window.setBounds(state.bounds);
    } else {
      // Give window a initial size.
      const size = this.window.getContentSize();
      if (size.width < 2 && size.height < 2)
        this.window.setContentSize({width: 600, height: 400});
      this.window.center();
    }
  }

  // Helper for cases that need to guard against double close.
  close() {
    if (!this.isClosed)
      this.window.close();
  }

  // Return the main view of the window, on which user is working on.
  getMainView(): BaseView | null {
    return null;
  }

  // Set window's size automatically to the preferred size of content view.
  resizeToFitContentView(override: {width?: number, height?: number} = {}) {
    let contentSize: gui.SizeF;
    if (override.width && override.height) {
      contentSize = override as gui.SizeF;
    } else {
      contentSize = Object.assign(this.contentView.getPreferredSize(), override);
      if (override.width)
        contentSize.height = this.contentView.getPreferredHeightForWidth(override.width);
      else if (override.height)
        contentSize.width = this.contentView.getPreferredWidthForHeight(override.height);
    }
    this.window.setContentSize(contentSize);
  }
}
