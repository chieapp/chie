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
import apiManager, {sortByPriority} from './api-manager';
import {ConfigStoreItem} from '../model/config-store';
import {Selection} from '../model/param';
import {WebServiceData, WebServiceOptions, WebServiceType} from '../model/web-service';
import {collectGarbage} from './gc-center';
import {deepAssign, matchClass} from '../util/object-utils';
import {getNextId} from '../util/id-generator';

type ServiceManagerData = Record<string, {
  serviceName: string,
  service: WebServiceData,
  view: string,
}>;

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

export type ServiceRecord = {
  name: string,
  serviceType: WebServiceType<WebAPI>,
  apiTypes: WebAPIType[],
  viewTypes: BaseViewType[],
  description?: string,
  priority?: number,
  params?: Param[],
};

export class ServiceManager extends ConfigStoreItem {
  onNewInstance: Signal<(instance: Instance, index: number) => void> = new Signal;
  onRemoveInstance: Signal<(instance: Instance) => void> = new Signal;

  #services: Record<string, ServiceRecord> = {};
  #views: BaseViewType[] = [];
  #instances: Record<string, Instance> = {};

  deserialize(data: ServiceManagerData) {
    if (!data)  // accepts empty data
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "services": ${JSON.stringify(data)}.`);
    this.#instances = {};
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
      const viewType = this.#views.find(v => v.name == item.view);
      if (!viewType)
        throw new Error(`Unknown View "${item.view}".`);
      // Deserialize using the service type's method.
      const options = record.serviceType.deserialize(item.service);
      const service = new record.serviceType(options);
      this.#instances[id] = {id, serviceName, service, viewType};
    }
  }

  serialize() {
    const data: ServiceManagerData = {};
    for (const id in this.#instances) {
      const ins = this.#instances[id];
      data[id] = {
        serviceName: ins.serviceName,
        service: ins.service.serialize(),
        view: ins.viewType.name,
      };
    }
    return data;
  }

  registerView(viewType: BaseViewType) {
    if (!Object.prototype.isPrototypeOf.call(BaseView, viewType))
      throw new Error('Registered View must inherit from BaseView.');
    if (this.#views.find(v => v.name == viewType.name))
      throw new Error(`View "${viewType.name}" has already been registered.`);
    this.#views.push(viewType);
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
    if (record.viewTypes.length < 1)
      throw new Error(`Found no view when registering service "${record.name}".`);
    for (const viewType of record.viewTypes) {
      if (!this.#views.includes(viewType))
        throw new Error(`View "${viewType.name}" is not registered.`);
    }
    this.#services[record.name] = record;
  }

  getRegisteredServices() {
    return Object.values(this.#services);
  }

  getServiceSelections(): Selection[] {
    return Object.keys(this.#services).map(k => ({name: k, value: this.#services[k]})).sort(sortByPriority);
  }

  createInstance(name: string, serviceName: string, endpoint: APIEndpoint, viewType: BaseViewType, options?: Partial<WebServiceOptions<WebAPI>>) {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    // Do runtime check of API type compatibility.
    const {icon, apiType} = apiManager.getAPIRecord(endpoint.type);
    const {apiTypes, serviceType, viewTypes} = this.#services[serviceName];
    if (!apiTypes.find(A => matchClass(A, apiType)))
      throw new Error(`Service "${serviceName}" does not support API type "${endpoint.type}".`);
    if (!viewTypes.find(V => matchClass(V, viewType)))
      throw new Error(`Service "${serviceName}" does not support View type "${viewType.name}".`);
    // Create a new instance of service.
    const ids = Object.keys(this.#instances);
    const id = getNextId(name, ids);
    const serviceOptions = deepAssign({name, api: new apiType(endpoint), icon}, options);
    if (serviceOptions.icon)
      serviceOptions.icon = this.#copyIcon(serviceOptions.icon);
    const instance = {
      id,
      serviceName,
      service: new serviceType(serviceOptions),
      viewType,
    };
    this.#instances[id] = instance;
    this.onNewInstance.emit(instance, ids.length);
    this.saveConfig();
    return instance;
  }

  setInstanceIcon(instance: Instance, icon: Icon) {
    this.#removeIcon(instance.service.icon);
    instance.service.setIcon(this.#copyIcon(icon));
  }

  removeInstanceById(id: string) {
    const instance = this.getInstanceById(id);
    this.#removeIcon(instance.service.icon);
    instance.service.destructor();
    delete this.#instances[id];
    this.onRemoveInstance.emit(instance);
    this.saveConfig();
    collectGarbage();
  }

  getInstanceById(id: string) {
    if (!(id in this.#instances))
      throw new Error(`Can not find instance with ID: ${id}`);
    return this.#instances[id];
  }

  getInstances() {
    return Object.values(this.#instances);
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
