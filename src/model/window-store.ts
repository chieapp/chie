import BaseWindow, {WindowState} from '../view/base-window';

type WindowCreator = (id: string) => BaseWindow;

export type WindowStoreData = Record<string, {state: WindowState, opened?: boolean}>;

export default class WindowStore {
  #windowCreator: WindowCreator;
  #windowStates: Record<string, WindowState> = {};
  #windows: Record<string, BaseWindow> = {};

  constructor(windowCreator: WindowCreator) {
    this.#windowCreator = windowCreator;
  }

  deserialize(data: WindowStoreData) {
    if (typeof data != 'object')  // accepts empty data
      data = {};
    this.#windowStates = {};
    for (const id in data) {
      const wd = data[id];
      this.#windowStates[id] = wd.state;
      if (wd.opened)
        this.showWindow(id);
    }
  }

  serialize() {
    const data: WindowStoreData = {};
    for (const id in this.#windowStates) {
      data[id] = {
        state: this.#windowStates[id],
        opened: !!this.#windows[id],
      };
    }
    return data;
  }

  // Try get window with |id|.
  getWindow(id: string) {
    return this.#windows[id];
  }

  // Get or create window with |id|. The window is created lazily and will
  // be destroyed when closed.
  getOrCreateWindow(id: string) {
    let win = this.#windows[id];
    if (!win) {
      win = this.#windows[id] = this.#windowCreator(id);
      if (id in this.#windowStates) {
        win.restoreState(this.#windowStates[id]);
      } else {
        win.restoreState({});
        win.window.center();
      }
      win.window.onClose = () => {
        this.saveWindowState(id);
        // It is possible to cache, but windows are cheap to create in "gui" so
        // we just recreate the window every time.
        delete this.#windows[id];
      };
    }
    return win;
  }

  // Call getWindow and show, it is used most commonly so add a method for it.
  showWindow(id: string) {
    const win = this.getOrCreateWindow(id);
    win.window.activate();
    return win;
  }

  closeWindow(id: string) {
    this.#windows[id]?.window.close();
  }

  saveWindowState(id: string) {
    const win = this.#windows[id];
    if (!win)  // not opened
      return;
    const state = win.saveState();
    if (state)
      this.#windowStates[id] = state;
    else  // some windows explicitly do not keep states
      this.removeWindowState(id);
  }

  removeWindowState(id: string) {
    delete this.#windowStates[id];
  }

  saveWindowStates() {
    for (const id in this.#windows)
      this.saveWindowState(id);
    return this.#windowStates;
  }
}
