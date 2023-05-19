import gui from 'gui';

import BaseChatService from '../model/base-chat-service';
import IconButton from '../view/icon-button';
import Param from '../model/param';
import serviceManager from '../controller/service-manager';

export default class SwitcherButton extends IconButton {
  service: BaseChatService;
  param: Param;

  constructor(service: BaseChatService, param: Param) {
    super('switch');
    this.service = service;
    this.param = param;

    this.updateTitle();
    this.view.setTooltip(`Switch ${param.displayName}`);
    this.connections.add(service.onChangeAPIParams.connect(this.updateTitle.bind(this)));
    this.onClick = this.runMenu.bind(this);
  }

  updateTitle() {
    let title = this.service.api.getParam(this.param.name);
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
          this.service.setAPIParam(this.param.name, str);
          serviceManager.saveConfig();
        },
      }));
    } else if (this.param.selections) {
      options = this.param.selections.map(selection => ({
        label: selection.name,
        onClick: () => {
          this.service.setAPIParam(this.param.name, selection.value);
          serviceManager.saveConfig();
        },
      }));
    } else {
      throw new Error(`Parameter ${this.param.displayName} does not have preset choices.`);
    }
    gui.Menu.create(options).popup();
  }
}
