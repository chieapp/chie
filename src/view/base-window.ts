import gui from 'gui';
import AppMenu from './app-menu';

export interface WindowState {
  bounds: gui.RectF;
}

export default class BaseWindow {
  window: gui.Window;
  menuBar: AppMenu;

  constructor(options: gui.WindowOptions = {}) {
    this.window = gui.Window.create(options);
    if (process.platform != 'darwin') {
      this.menuBar = new AppMenu(this);
      this.window.setMenuBar(this.menuBar.menu);
      this.window.setMenuBarVisible(false);
    }

    const windowManager = require('../controller/window-manager').default;
    windowManager.addWindow(this);
    this.window.onClose = () => windowManager.removeWindow(this);
  }

  saveState(): WindowState {
    return {bounds: this.window.getBounds()};
  }

  restoreState(state: WindowState) {
    this.window.setBounds(state.bounds);
  }
}
