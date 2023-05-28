import gui from 'gui';

import BaseChatService from '../model/base-chat-service';
import IconButton from '../view/icon-button';
import Param from '../model/param';
import serviceManager from '../controller/service-manager';

export default class SwitcherButton extends IconButton {
  service: BaseChatService;
  param: Param;
  isAPIParam: boolean;

  constructor(service: BaseChatService, param: Param, isAPIParam: boolean) {
    super('switch');
    this.service = service;
    this.param = param;
    this.isAPIParam = isAPIParam;

    this.updateTitle();
    this.view.setTooltip(`Switch ${param.displayName}`);
    this.onClick = this.runMenu.bind(this);

    const signal = this.isAPIParam ? service.onChangeAPIParams : service.onChangeParams;
    this.connections.add(signal.connect(this.updateTitle.bind(this)));
  }

  updateTitle() {
    let title = this.isAPIParam ?
      this.service.getAPIParam(this.param.name) :
      this.service.getParam(this.param.name);
    if (this.param.type == 'selection')
      title = this.param.selections.find(s => s.value == title)?.name;
    if (title)
      this.setTitle(title);
  }

  runMenu() {
    let options: object[];
    if (this.param.preset) {
      options = this.param.preset.map(str => ({
        label: str,
        onClick: () => {
          if (this.isAPIParam)
            this.service.setAPIParam(this.param.name, str);
          else
            this.service.setParam(this.param.name, str);
          serviceManager.saveConfig();
        },
      }));
    } else if (this.param.selections) {
      options = this.param.selections.map(selection => ({
        label: selection.name,
        onClick: () => {
          if (this.isAPIParam)
            this.service.setAPIParam(this.param.name, selection.value);
          else
            this.service.setParam(this.param.name, selection.value);
          serviceManager.saveConfig();
        },
      }));
    } else {
      throw new Error(`Parameter ${this.param.displayName} does not have preset choices.`);
    }
    const point = this.view.getBoundsInScreen();
    point.y += point.height;
    if (process.platform == 'darwin')  // macOS slightly shows menu higher
      point.y += 8;
    gui.Menu.create(options).popupAt(point);
  }
}
