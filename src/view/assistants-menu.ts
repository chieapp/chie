import gui from 'gui';

import BaseView, {MenuItemOptions} from './base-view';
import Instance from '../model/instance';
import SignalsOwner from '../model/signals-owner';
import serviceManager from '../controller/service-manager';

type createAssistantMenuItemFunc = (instance: Instance, index: number) => MenuItemOptions<BaseView>;

export default class AssistantsMenu extends SignalsOwner {
  menu: gui.Menu;
  createAssistantMenuItem: createAssistantMenuItemFunc;

  #assistants: {instance: Instance, item: gui.MenuItem}[] = [];

  constructor(menu: gui.Menu, createAssistantMenuItem: createAssistantMenuItemFunc) {
    super();
    this.menu = menu;
    this.createAssistantMenuItem = createAssistantMenuItem;
    // Insert menu items for existing instances.
    serviceManager.getInstances().forEach(this.#onNewInstance.bind(this));
    // Connect to serviceManager to update assistant menu items.
    this.connections.add(serviceManager.onNewInstance.connect(
      this.#onNewInstance.bind(this)));
    this.connections.add(serviceManager.onRemoveInstance.connect(
      this.#onRemoveInstance.bind(this)));
  }

  #onNewInstance(instance: Instance, index: number) {
    const item = gui.MenuItem.create(this.createAssistantMenuItem(instance, index));
    this.menu.append(item);
    this.#assistants.push({instance, item});
  }

  #onRemoveInstance(instance: Instance) {
    const index = this.#assistants.findIndex(a => a.instance == instance);
    if (index < 0)
      throw new Error('Removing unexist assistant from menu bar.');
    this.menu.remove(this.#assistants[index].item);
    this.#assistants.splice(index, 1);
    if (index != this.#assistants.length)  // no need to change when removing last item
      this.#updateAssistantsMenuAccelerators();
  }

  #updateAssistantsMenuAccelerators() {
    for (let i = 0; i < this.#assistants.length; ++i)
      this.#assistants[i].item.setAccelerator(`CmdOrCtrl+${i + 1}`);
  }
}
