import gui from 'gui';

import AppMenu from './app-menu';
import SignalsOwner from '../model/signals-owner';

export interface WindowState {
  bounds: gui.RectF;
}

export interface BaseWindowOptions extends gui.WindowOptions {
  pressEscToClose?: boolean;
  // On modern macOS apps the NSVisualEffectView is usually used as the content
  // view, this option provides a way to disable it.
  useClassicBackground?: boolean;
}

export default class BaseWindow extends SignalsOwner {
  window: gui.Window;
  contentView: gui.Container;
  menuBar: AppMenu;

  constructor(options: BaseWindowOptions = {}) {
    super();

    this.window = gui.Window.create(options);
    if (process.platform == 'win32')
      this.window.setBackgroundColor('#F5F5F5');
    if (process.platform != 'darwin') {
      this.menuBar = new AppMenu(this);
      this.window.setMenuBar(this.menuBar.menu);
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

    const windowManager = require('../controller/window-manager').default;
    windowManager.addWindow(this);
    this.window.onClose = () => {
      this.destructor();
      windowManager.removeWindow(this);
    };
  }

  saveState(): WindowState {
    return {bounds: this.window.getBounds()};
  }

  restoreState(state: WindowState) {
    this.window.setBounds(state.bounds);
  }
}
