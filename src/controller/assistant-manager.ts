import {Signal} from 'typed-signals';

import APIEndpoint from '../model/api-endpoint';
import Assistant from '../model/assistant';
import Icon from '../model/icon';
import WebService, {
  WebServiceData,
  WebServiceOptions,
} from '../model/web-service';
import serviceManager from '../controller/service-manager';
import {BaseViewType} from '../view/base-view';
import {ConfigStoreItem} from '../model/config-store';
import {collectGarbage} from './gc-center';
import {matchClass} from '../util/object-utils';
import {getNextId} from '../util/id-generator';

type AssistantManagerDataItem = {
  serviceName: string,
  service: WebServiceData,
  view: string,
  shortcut?: string,
  hasTray?: boolean,
  trayIcon?: string,
};
type AssistantManagerData = Record<string, AssistantManagerDataItem>;

export class AssistantManager extends ConfigStoreItem {
  onNewAssistant: Signal<(assistant: Assistant, index: number) => void> = new Signal;
  onRemoveAssistant: Signal<(assistant: Assistant) => void> = new Signal;
  onReorderAssistant: Signal<(assistant: Assistant, fromIndex: number, toIndex:number) => void> = new Signal;

  #assistants: Assistant[] = [];

  deserialize(data: AssistantManagerData) {
    if (!data)  // accepts empty data
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "services": ${JSON.stringify(data)}.`);
    this.#assistants = [];
    for (const id in data) {
      const item = data[id];
      if (typeof item.serviceName != 'string' ||
          typeof item.service != 'object' ||
          typeof item.view != 'string')
        throw new Error(`Unknown data for Assistant: ${JSON.stringify(item)}.`);
      // Get the service type first.
      const serviceName = item.serviceName;
      const record = serviceManager.getServiceByName(serviceName);
      if (!record)
        throw new Error(`Unknown service "${serviceName}".`);
      // Check view type.
      const viewClass = serviceManager.getRegisteredViews().find(v => v.name == item.view);
      if (!viewClass)
        throw new Error(`Unknown View "${item.view}".`);
      // Find out a deserialize method in the prototype chain.
      let baseClass = record.serviceClass;
      while (!baseClass.deserialize && baseClass != WebService)
        baseClass = baseClass.prototype;
      if (!baseClass.deserialize)
        throw new Error(`Can not find a deserialize method for service "${serviceName}".`);
      // Deserialize using the service type's method.
      const options = baseClass.deserialize(item.service);
      const service = new record.serviceClass(options);
      const assistant = new Assistant(id, service, viewClass);
      if (item.shortcut)
        assistant.setShortcut(item.shortcut);
      if (item.hasTray) {
        const icon = item.trayIcon ? new Icon({chieURL: item.trayIcon}) : service.icon;
        assistant.setTrayIcon(icon);
      }
      this.#assistants.push(assistant);
    }
  }

  serialize() {
    const data: AssistantManagerData = {};
    for (const assistant of this.#assistants) {
      const item: AssistantManagerDataItem = {
        serviceName: assistant.service.constructor.name,
        service: assistant.service.serialize(),
        view: assistant.viewClass.name,
      };
      if (assistant.shortcut)
        item.shortcut = assistant.shortcut;
      if (assistant.tray) {
        item.hasTray = true;
        if (assistant.trayIcon != assistant.service.icon)
          item.trayIcon = assistant.trayIcon.getChieURL();
      }
      data[assistant.id] = item;
    }
    return data;
  }

  createAssistant(name: string, serviceName: string, endpoint: APIEndpoint, viewClass: BaseViewType, options?: Partial<WebServiceOptions>) {
    const service = serviceManager.createService(name, serviceName, endpoint, options);
    // Do runtime check of API type compatibility.
    const {viewClasses} = serviceManager.getServiceByName(serviceName);
    if (!viewClasses.find(V => matchClass(V, viewClass)))
      throw new Error(`Service "${service.constructor.name}" does not support View type "${viewClass.name}".`);
    // Create a new assistant of service.
    const ids = this.#assistants.map(assistant => assistant.id);
    const id = getNextId(service.name, ids);
    const assistant = new Assistant(id, service, viewClass);
    this.#assistants.push(assistant);
    this.onNewAssistant.emit(assistant, ids.length);
    this.saveConfig();
    return assistant;
  }

  removeAssistantById(id: string) {
    const index = this.#assistants.findIndex(assistant => assistant.id == id);
    if (index == -1)
      throw new Error(`Can not find assistant of ID "${id}".`);
    const assistant = this.#assistants[index];
    assistant.destructor();
    this.#assistants.splice(index, 1);
    this.onRemoveAssistant.emit(assistant);
    this.saveConfig();
    collectGarbage();
  }

  getAssistantById(id: string) {
    const assistant = this.#assistants.find(assistant => assistant.id == id);
    if (!assistant)
      throw new Error(`Can not find assistant of ID "${id}".`);
    return assistant;
  }

  reorderAssistant(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.#assistants.length ||
        toIndex < 0 || toIndex >= this.#assistants.length)
      throw new RangeError(`Invalid index: ${fromIndex}, ${toIndex}.`);
    const [assistant] = this.#assistants.splice(fromIndex, 1);
    this.#assistants.splice(toIndex, 0, assistant);
    this.onReorderAssistant.emit(assistant, fromIndex, toIndex);
    this.saveConfig();
  }

  getAssistants() {
    return this.#assistants;
  }
}

export default new AssistantManager;
