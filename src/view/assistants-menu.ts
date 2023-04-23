import gui from 'gui';

import BaseView, {MenuItemOptions} from './base-view';
import Instance from '../model/instance';
import SignalsOwner from '../model/signals-owner';
import serviceManager from '../controller/service-manager';

type createAssistantMenuItemFunc = (instance: Instance) => MenuItemOptions<BaseView>;

export default class AssistantsMenu extends SignalsOwner {
  menu: gui.Menu;
  menuIndex: number;
  acceleratorPrefix?: string;
  createAssistantMenuItem: createAssistantMenuItemFunc;

  #assistants: {instance: Instance, item: gui.MenuItem}[] = [];

  constructor(menu: gui.Menu, menuIndex: number, acceleratorPrefix: string | null, createAssistantMenuItem: createAssistantMenuItemFunc) {
    super();
    this.menu = menu;
    this.menuIndex = menuIndex;
    this.acceleratorPrefix = acceleratorPrefix;
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
    const options = this.createAssistantMenuItem(instance);
    if (this.acceleratorPrefix)
      options.accelerator = `${this.acceleratorPrefix}+${index + 1}`;
    const item = gui.MenuItem.create(options);
    if (this.menuIndex == -1)
      this.menu.append(item);
    else
      this.menu.insert(item, this.menuIndex + index);
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
    if (!this.acceleratorPrefix)
      return;
    for (let i = 0; i < this.#assistants.length; ++i)
      this.#assistants[i].item.setAccelerator(`${this.acceleratorPrefix}+${i + 1}`);
  }
}
