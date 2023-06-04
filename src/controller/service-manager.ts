import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'node:path';
import {Signal} from 'typed-signals';

import APIEndpoint from '../model/api-endpoint';
import BaseView, {BaseViewType} from '../view/base-view';
import Icon from '../model/icon';
import Instance from '../model/instance';
import Param from '../model/param';
import WebAPI from '../model/web-api';
import WebService, {
  WebServiceData,
  WebServiceOptions,
  WebServiceType,
} from '../model/web-service';
import apiManager, {sortByPriority} from '../controller//api-manager';
import shortcutManager from '../controller/shortcut-manager';
import {ConfigStoreItem} from '../model/config-store';
import {Selection} from '../model/param';
import {collectGarbage} from './gc-center';
import {deepAssign, matchClass} from '../util/object-utils';
import {getNextId} from '../util/id-generator';

type ServiceManagerDataItem = {
  serviceName: string,
  service: WebServiceData,
  view: string,
  shortcut?: string,
};
type ServiceManagerData = Record<string, ServiceManagerDataItem>;

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

export type ServiceRecord = {
  name: string,
  serviceClass: WebServiceType<WebAPI>,
  apiClasses: WebAPIType[],
  viewClasses: BaseViewType[],
  description?: string,
  priority?: number,
  params?: Param[],
};

export interface InstanceOptions extends WebServiceOptions {
  shortcut?: string;
}

export class ServiceManager extends ConfigStoreItem {
  onNewInstance: Signal<(instance: Instance, index: number) => void> = new Signal;
  onRemoveInstance: Signal<(instance: Instance) => void> = new Signal;
  onReorderInstance: Signal<(instance: Instance, fromIndex: number, toIndex:number) => void> = new Signal;

  #services: Record<string, ServiceRecord> = {};
  #views: BaseViewType[] = [];
  #instances: Instance[] = [];

  deserialize(data: ServiceManagerData) {
    if (!data)  // accepts empty data
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "services": ${JSON.stringify(data)}.`);
    this.#instances = [];
    for (const id in data) {
      const item = data[id];
      if (typeof item.serviceName != 'string' ||
          typeof item.service != 'object' ||
          typeof item.view != 'string')
        throw new Error(`Unknown data for Instance: ${JSON.stringify(item)}.`);
      // Get the service type first.
      const serviceName = item.serviceName;
      if (!(serviceName in this.#services))
        throw new Error(`Unknown service "${serviceName}".`);
      const record = this.#services[serviceName];
      // Check view type.
      const viewClass = this.#views.find(v => v.name == item.view);
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
      const instance: Instance = {id, serviceName, service, viewClass};
      if (item.shortcut)
        this.setInstanceShortcut(instance, item.shortcut);
      this.#instances.push(instance);
    }
  }

  serialize() {
    const data: ServiceManagerData = {};
    for (const instance of this.#instances) {
      const item: ServiceManagerDataItem = {
        serviceName: instance.serviceName,
        service: instance.service.serialize(),
        view: instance.viewClass.name,
      };
      if (instance.shortcut)
        item.shortcut = instance.shortcut;
      data[instance.id] = item;
    }
    return data;
  }

  registerView(viewClass: BaseViewType) {
    if (!Object.prototype.isPrototypeOf.call(BaseView, viewClass))
      throw new Error('Registered View must inherit from BaseView.');
    if (this.#views.find(v => v.name == viewClass.name))
      throw new Error(`View "${viewClass.name}" has already been registered.`);
    this.#views.push(viewClass);
  }

  getRegisteredViews() {
    return this.#views;
  }

  getViewSelections(): Selection[] {
    return this.#views.map(v => ({name: v.name, value: v}));
  }

  registerService(record: ServiceRecord) {
    if (record.name in this.#services)
      throw new Error(`Service "${record.name}" has already been registered.`);
    if (record.viewClasses.length < 1)
      throw new Error(`Found no view when registering service "${record.name}".`);
    if (!matchClass(WebService, record.serviceClass))
      throw new Error('The serviceClass must inherit from WebService.');
    for (const viewClass of record.viewClasses) {
      if (!this.#views.includes(viewClass))
        throw new Error(`View "${viewClass.name}" is not registered.`);
    }
    this.#services[record.name] = record;
  }

  getRegisteredServices() {
    return Object.values(this.#services);
  }

  getServiceSelections(): Selection[] {
    return Object.keys(this.#services).map(k => ({name: k, value: this.#services[k]})).sort(sortByPriority);
  }

  createInstance(name: string, serviceName: string, endpoint: APIEndpoint, viewClass: BaseViewType, options?: Partial<InstanceOptions>) {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    // Do runtime check of API type compatibility.
    const {icon, apiClass} = apiManager.getAPIRecord(endpoint.type);
    const {apiClasses, serviceClass, viewClasses} = this.#services[serviceName];
    if (!apiClasses.find(A => matchClass(A, apiClass)))
      throw new Error(`Service "${serviceName}" does not support API type "${endpoint.type}".`);
    if (!viewClasses.find(V => matchClass(V, viewClass)))
      throw new Error(`Service "${serviceName}" does not support View type "${viewClass.name}".`);
    // Create a new instance of service.
    const ids = this.#instances.map(instance => instance.id);
    const id = getNextId(name, ids);
    const serviceOptions = deepAssign({name, api: new apiClass(endpoint), icon}, options);
    if (serviceOptions.icon)
      serviceOptions.icon = this.#copyIcon(serviceOptions.icon);
    const instance: Instance = {
      id,
      serviceName,
      service: new serviceClass(serviceOptions),
      viewClass,
    };
    if (options?.shortcut)
      this.setInstanceShortcut(instance, options.shortcut);
    this.#instances.push(instance);
    this.onNewInstance.emit(instance, ids.length);
    this.saveConfig();
    return instance;
  }

  setInstanceShortcut(instance: Instance, shortcut: string | null) {
    instance.shortcut = shortcut;
    shortcutManager.setShortcutForChatWindow(instance.id, shortcut);
  }

  setInstanceIcon(instance: Instance, icon: Icon) {
    this.#removeIcon(instance.service.icon);
    instance.service.setIcon(this.#copyIcon(icon));
  }

  removeInstanceById(id: string) {
    const index = this.#instances.findIndex(instance => instance.id == id);
    if (index == -1)
      throw new Error(`Can not find instance of ID "${id}".`);
    const instance = this.#instances[index];
    shortcutManager.setShortcutForChatWindow(id, null);
    this.#removeIcon(instance.service.icon);
    instance.service.destructor();
    this.#instances.splice(index, 1);
    this.onRemoveInstance.emit(instance);
    this.saveConfig();
    collectGarbage();
  }

  getInstanceById(id: string) {
    const instance = this.#instances.find(instance => instance.id == id);
    if (!instance)
      throw new Error(`Can not find instance of ID "${id}".`);
    return instance;
  }

  reorderInstance(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.#instances.length ||
        toIndex < 0 || toIndex >= this.#instances.length)
      throw new RangeError(`Invalid index: ${fromIndex}, ${toIndex}.`);
    const [instance] = this.#instances.splice(fromIndex, 1);
    this.#instances.splice(toIndex, 0, instance);
    this.onReorderInstance.emit(instance, fromIndex, toIndex);
    this.saveConfig();
  }

  getInstances() {
    return this.#instances;
  }

  // If the icon file is located outside app's bundle, copy it to user data dir.
  #copyIcon(icon: Icon) {
    if (icon.filePath.startsWith(Icon.builtinIconsPath))
      return icon;
    const filename = crypto.randomUUID() + path.extname(icon.filePath);
    const filePath = path.join(Icon.userIconsPath, filename);
    fs.copySync(icon.filePath, filePath);
    return new Icon({filePath});
  }

  // If the icon file is managed by us, remove it.
  #removeIcon(icon: Icon) {
    if (icon.filePath.startsWith(Icon.userIconsPath))
      fs.remove(icon.filePath);
  }
}

export default new ServiceManager;
