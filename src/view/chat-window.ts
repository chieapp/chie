import BaseView from './base-view';
import BaseWindow from './base-window';
import Instance from '../model/instance';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export default class ChatWindow extends BaseWindow {
  instance: Instance;
  chatView: BaseView<WebService<WebAPI>>;

  constructor(instance: Instance) {
    super();
    this.instance = instance;

    this.window.setContentSize({width: 600, height: 400});
    this.window.setTitle(instance.service.name);
    this.window.onFocus = () => this.chatView.onFocus();
    this.window.onClose = () => this.destructor();

    this.chatView = new instance.viewType(instance.service);
    this.window.setContentView(this.chatView.view);

    this.chatView.initAsMainView();
  }

  destructor() {
    this.chatView.destructor();
  }

  show() {
    this.window.center();
    this.window.activate();
  }
}
