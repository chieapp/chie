import gui from 'gui';

import Assistant from '../model/assistant';
import BaseView, {MenuItemOptions} from './base-view';
import SignalsOwner from '../model/signals-owner';
import assistantManager from '../controller/assistant-manager';

type createAssistantMenuItemFunc = (assistant: Assistant) => MenuItemOptions<BaseView>;

export default class AssistantsMenu extends SignalsOwner {
  menu: gui.Menu;
  menuIndex: number;
  acceleratorPrefix?: string;
  createAssistantMenuItem: createAssistantMenuItemFunc;

  #assistants: {assistant: Assistant, item: gui.MenuItem}[] = [];

  constructor(menu: gui.Menu, menuIndex: number, acceleratorPrefix: string | null, createAssistantMenuItem: createAssistantMenuItemFunc) {
    super();
    this.menu = menu;
    this.menuIndex = menuIndex;
    this.acceleratorPrefix = acceleratorPrefix;
    this.createAssistantMenuItem = createAssistantMenuItem;
    // Insert menu items for existing assistants.
    assistantManager.getAssistants().forEach(this.#onNewAssistant.bind(this));
    // Connect to assistantManager to update assistant menu items.
    this.connections.add(assistantManager.onNewAssistant.connect(
      this.#onNewAssistant.bind(this)));
    this.connections.add(assistantManager.onRemoveAssistant.connect(
      this.#onRemoveAssistant.bind(this)));
    this.connections.add(assistantManager.onReorderAssistant.connect(
      this.#onReorderAssistant.bind(this)));
  }

  #onNewAssistant(assistant: Assistant, index: number) {
    const item = this.#createMenuItem(assistant, index);
    this.menu.insert(item, this.menuIndex + index);
    this.#assistants.push({assistant, item});
  }

  #onRemoveAssistant(assistant: Assistant) {
    const index = this.#assistants.findIndex(a => a.assistant == assistant);
    if (index < 0)
      throw new Error('Removing unexist assistant from menu bar.');
    this.menu.remove(this.#assistants[index].item);
    this.#assistants.splice(index, 1);
    if (index != this.#assistants.length)  // no need to change when removing last item
      this.#updateAssistantsMenuAccelerators();
  }

  #onReorderAssistant(assistant: Assistant, fromIndex: number, toIndex: number) {
    const item = this.#assistants[fromIndex].item;
    this.menu.remove(item);
    this.menu.insert(item, this.menuIndex + toIndex);
    this.#assistants.splice(fromIndex, 1);
    this.#assistants.splice(toIndex, 0, {assistant, item});
    this.#updateAssistantsMenuAccelerators();
  }

  #updateAssistantsMenuAccelerators() {
    if (!this.acceleratorPrefix)
      return;
    for (let i = 0; i < this.#assistants.length; ++i)
      this.#assistants[i].item.setAccelerator(`${this.acceleratorPrefix}+${i + 1}`);
  }

  #createMenuItem(assistant: Assistant, index: number) {
    const options = this.createAssistantMenuItem(assistant);
    if (this.acceleratorPrefix)
      options.accelerator = `${this.acceleratorPrefix}+${index + 1}`;
    return gui.MenuItem.create(options);
  }
}
