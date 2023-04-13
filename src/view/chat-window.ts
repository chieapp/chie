import BaseView, {ViewState} from './base-view';
import BaseWindow, {WindowState} from './base-window';
import Instance from '../model/instance';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export interface ChatWindowState extends WindowState {
  viewState?: ViewState;
}

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

  saveState(): ChatWindowState {
    return Object.assign(super.saveState(), {
      viewState: this.chatView.saveState(),
    });
  }

  restoreState(state: ChatWindowState) {
    if (state.viewState)
      this.chatView.restoreState(state.viewState);
    super.restoreState(state);
  }
}
