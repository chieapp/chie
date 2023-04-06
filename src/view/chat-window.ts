import gui from 'gui';

import AppMenu from './app-menu';
import BaseView from '../view/base-view';
import Instance from '../model/instance';

export default class ChatWindow {
  instance: Instance;
  window: gui.Window;
  chatView: BaseView;
  menuBar: AppMenu;

  constructor(instance: Instance) {
    this.instance = instance;

    this.window = gui.Window.create({});
    this.window.setContentSize({width: 600, height: 400});
    this.window.setTitle(instance.name);
    this.window.onFocus = () => this.chatView.onFocus();
    this.window.onClose = () => this.destructor();

    this.chatView = new instance.viewType(instance.name, instance.serviceType, instance.api);
    this.window.setContentView(this.chatView.view);

    if (process.platform != 'darwin') {
      this.menuBar = new AppMenu(this.window);
      this.window.setMenuBar(this.menuBar.menu);
    }

    this.chatView.initAsMainView();
    this.window.center();
    this.window.activate();
  }

  destructor() {
    this.chatView.destructor();
  }
}
