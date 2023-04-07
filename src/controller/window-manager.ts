import gui from 'gui';
import AppMenu from '../view/app-menu';
import BaseWindow from '../view/base-window';

export class WindowManager {
  #appMenu?: AppMenu;
  #windows: BaseWindow[] = [];

  constructor() {
    if (process.platform == 'darwin') {
      this.#appMenu = new AppMenu();
      gui.app.setApplicationMenu(this.#appMenu.menu);
    }
  }

  addWindow(win: BaseWindow) {
    this.#windows.push(win);
  }

  removeWindow(win: BaseWindow) {
    this.#windows.splice(this.#windows.indexOf(win), 1);
  }

  getCurrentWindow() {
    return this.#windows.find(w => w.window.isActive());
  }
}

export default new WindowManager();
