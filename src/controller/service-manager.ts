import {Signal} from 'typed-signals';

import APIEndpoint from '../model/api-endpoint';
import BaseView, {BaseViewType} from '../view/base-view';
import Instance from '../model/instance';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';
import apiManager from './api-manager';
import {ConfigStoreItem} from '../model/config-store';
import {Selection} from '../model/param';
import {collectGarbage} from './gc-center';
import {getNextId} from '../util/id-generator';

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

interface WebServiceType {
  new (name, api): WebService<WebAPI>;
  deserialize(config: object): WebService<WebAPI>;
}

export type ServiceRecord = {
  serviceName?: string,
  serviceType: WebServiceType,
  apiTypes: WebAPIType[],
  viewType: BaseViewType,
};

export class ServiceManager extends ConfigStoreItem {
  onNewInstance: Signal<(instance: Instance, index: number) => void> = new Signal;
  onRemoveInstance: Signal<(instance: Instance) => void> = new Signal;

  #services: Record<string, ServiceRecord> = {};
  #views: BaseViewType[] = [];
  #instances: Record<string, Instance> = {};

  deserialize(data: object) {
    if (!data)  // accepts empty data
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "chats": ${JSON.stringify(data)}.`);
    this.#instances = {};
    for (const id in data) {
      const item = data[id];
      if (typeof item['serviceName'] != 'string' ||
          typeof item['service'] != 'object' ||
          typeof item['view'] != 'string')
        throw new Error(`Unknown data for Instance: ${JSON.stringify(item)}.`);
      // Get the service type first.
      const serviceName = item['serviceName'];
      if (!(serviceName in this.#services))
        throw new Error(`Unknown service "${serviceName}".`);
      const record = this.#services[serviceName];
      // Check view type.
      const viewType = this.#views.find(v => v.name == item['view']);
      if (!viewType)
        throw new Error(`Unknown View "${item['view']}".`);
      // Deserialize using the service type's method.
      const service = record.serviceType.deserialize(item['service']);
      this.#instances[id] = {id, serviceName, service, viewType};
    }
  }

  serialize() {
    const data = {};
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
    if (!(viewType.prototype instanceof BaseView))
      throw new Error('Registered View must inherit from BaseView.');
    if (this.#views.find(v => v.name == viewType.name))
      throw new Error(`View "${viewType.name}" has already been registered.`);
    this.#views.push(viewType);
  }

  getRegisteredViews() {
    return this.#views;
  }

  getViewSelections(): Selection<BaseViewType>[] {
    return this.#views.map(v => ({name: v.name, value: v}));
  }

  registerService(name: string, record: ServiceRecord) {
    if (name in this.#services)
      throw new Error(`Service "${name}" has already been registered.`);
    if (!this.#views.includes(record.viewType))
      throw new Error(`View "${record.viewType.name}" is not registered`);
    record.serviceName = name;
    this.#services[name] = record;
  }

  getServiceSelections(): Selection<ServiceRecord>[] {
    return Object.keys(this.#services).map(k => ({name: k, value: this.#services[k]}));
  }

  createInstance(name: string, serviceName: string, endpoint: APIEndpoint) {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    // Do runtime check of API type compatibility.
    const api = apiManager.createAPIForEndpoint(endpoint);
    const record = this.#services[serviceName];
    if (!record.apiTypes.find(A => api instanceof A))
      throw new Error(`Service "${serviceName}" does not support API type "${endpoint.type}".`);
    // Create a new instance of service.
    const ids = Object.keys(this.#instances);
    const id = getNextId(name, ids);
    const instance = {
      id,
      serviceName,
      service: new record.serviceType(name, api),
      viewType: record.viewType,
    };
    this.#instances[id] = instance;
    this.onNewInstance.emit(instance, ids.length);
    this.saveConfig();
    return instance;
  }

  removeInstanceById(id: string) {
    const instance = this.getInstanceById(id);
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
}

export default new ServiceManager;
