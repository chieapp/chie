import gui from 'gui';

import ChatService from '../model/chat-service';
import IconButton from './icon-button';
import Param from '../model/param';

export default class SwitcherButton extends IconButton {
  service: ChatService;
  param: Param;

  constructor(service: ChatService, param: Param) {
    super('switch');
    this.service = service;
    this.param = param;

    this.updateTitle();
    this.view.setTooltip(`Switch ${param.readableName}`);
    this.connections.add(service.onChangeParams.connect(this.updateTitle.bind(this)));
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
        onClick: () => this.service.setParam(this.param.name, str),
      }));
    } else if (this.param.selections) {
      options = this.param.selections.map(selection => ({
        label: selection.name,
        onClick: () => this.service.setParam(this.param.name, selection.value),
      }));
    } else {
      throw new Error(`Parameter ${this.param.readableName} does not have preset choices.`);
    }
    gui.Menu.create(options).popup();
  }
}
