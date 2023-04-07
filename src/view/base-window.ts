import gui from 'gui';
import AppMenu from './app-menu';
import windowManager from '../controller/window-manager';

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

    windowManager.addWindow(this);
    this.window.onClose = () => windowManager.removeWindow(this);
  }
}
