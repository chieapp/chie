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
    super({
      viewClass: instance.viewClass,
      useClassicBackground: true,
    });
    this.instance = instance;

    this.window.setTitle(instance.service.name);
    this.window.onFocus = () => this.chatView.onFocus();

    this.chatView = new instance.viewClass(instance.service);
    this.chatView.view.setStyle({flex: 1});
    this.contentView.addChildView(this.chatView.view);
    this.window.setContentSize(this.chatView.getSizeFromMainViewSize({width: 400, height: 400}));

    this.chatView.initAsMainView();
  }

  destructor() {
    super.destructor();
    this.chatView.destructor();
  }

  saveState(): ChatWindowState {
    return Object.assign(super.saveState(), {
      viewState: this.chatView.saveState(),
    });
  }

  restoreState(state: ChatWindowState) {
    this.chatView.restoreState(state.viewState ?? {});
    super.restoreState(state);
  }

  getMainView() {
    return this.chatView;
  }
}
