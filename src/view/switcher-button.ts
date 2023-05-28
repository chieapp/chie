import gui from 'gui';

import BaseChatService from '../model/base-chat-service';
import IconButton from '../view/icon-button';
import Param from '../model/param';
import prompt from '../util/prompt';
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
    // For selections show name instead of actual value.
    if (this.param.type == 'selection')
      title = this.param.selections.find(s => s.value == title)?.name;
    // Find default value.
    if (!title) {
      if (this.param.type == 'selection')
        title = this.param.selection;
      else
        title = String(this.param.value);
    }
    if (title)
      this.setTitle(title);
  }

  runMenu() {
    // Create items from params.
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
      // Allow custom value.
      options.push({type: 'separator'});
      options.push({
        label: 'Set custom value...',
        onClick: async () => {
          const result = await prompt(`Set ${this.param.displayName}`, this.title);
          if (result)
            this.#setParam(result);
        },
      });
    } else if (this.param.selections) {
      options = this.param.selections.map(selection => ({
        label: selection.name,
        onClick: this.#setParam.bind(this, selection.value),
      }));
    } else {
      throw new Error(`Parameter ${this.param.displayName} does not have preset choices.`);
    }
    // Popup menu under the button.
    const point = this.view.getBoundsInScreen();
    point.y += point.height;
    if (process.platform == 'darwin')  // macOS slightly shows menu higher
      point.y += 8;
    gui.Menu.create(options).popupAt(point);
  }

  #setParam(value: string) {
    if (this.isAPIParam)
      this.service.setAPIParam(this.param.name, value);
    else
      this.service.setParam(this.param.name, value);
    serviceManager.saveConfig();
  }
}
