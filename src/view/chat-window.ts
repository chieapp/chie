import Assistant from '../model/assistant';
import BaseView, {ViewState} from './base-view';
import BaseWindow, {WindowState} from './base-window';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export interface ChatWindowState extends WindowState {
  viewState?: ViewState;
}

export default class ChatWindow extends BaseWindow {
  assistant: Assistant;
  chatView: BaseView<WebService<WebAPI>>;

  constructor(assistant: Assistant) {
    super({
      viewClass: assistant.viewClass,
      useClassicBackground: true,
    });
    this.assistant = assistant;

    this.window.setTitle(assistant.service.name);
    this.window.onFocus = () => this.chatView.onFocus();

    this.chatView = new assistant.viewClass();
    this.chatView.view.setStyle({flex: 1});
    this.contentView.addChildView(this.chatView.view);
    this.window.setContentSize(this.chatView.getSizeFromMainViewSize({width: 400, height: 400}));

    this.chatView.loadService(assistant.service);
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
