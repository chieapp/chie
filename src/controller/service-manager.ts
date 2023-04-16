import APIEndpoint from '../model/api-endpoint';
import BaseView from '../view/base-view';
import Instance, {BaseViewType} from '../model/instance';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';
import apiManager from './api-manager';
import {ConfigStoreItem} from './config-store';
import {getNextId} from '../util/id-generator';

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

interface WebServiceType {
  new (name, api): WebService<WebAPI>;
  deserialize(config: object): WebService<WebAPI>;
}

type ServiceRecord = {
  serviceType: WebServiceType,
  apiTypes: WebAPIType[],
  viewType: BaseViewType,
};

export class ServiceManager implements ConfigStoreItem {
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
      if (typeof item['serviceType'] != 'string' ||
          typeof item['service'] != 'object' ||
          typeof item['view'] != 'string')
        throw new Error(`Unknown data for Instance: ${JSON.stringify(item)}.`);
      // Get the service type first.
      const serviceType = item['serviceType'];
      if (!(serviceType in this.#services))
        throw new Error(`Unknown service "${serviceType}".`);
      const record = this.#services[serviceType];
      // Check view type.
      const viewType = this.#views.find(v => v.name == item['view']);
      if (!viewType)
        throw new Error(`Unknown View "${item['view']}".`);
      // Deserialize using the service type's method.
      const service = record.serviceType.deserialize(item['service']);
      this.#instances[id] = {id, serviceType, service, viewType};
    }
  }

  serialize() {
    const data = {};
    for (const id in this.#instances) {
      const ins = this.#instances[id];
      data[id] = {
        serviceType: ins.serviceType,
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

  registerService(name: string, record: ServiceRecord) {
    if (name in this.#services)
      throw new Error(`Service "${name}" has already been registered.`);
    if (!this.#views.includes(record.viewType))
      throw new Error(`View "${record.viewType.name}" is not registered`);
    this.#services[name] = record;
  }

  createInstance(name: string, serviceType: string, endpoint: APIEndpoint) {
    if (!(serviceType in this.#services))
      throw new Error(`Service with name "${serviceType}" does not exist.`);
    // Do runtime check of API type compatibility.
    const api = apiManager.createAPIForEndpoint(endpoint);
    if (!this.#services[serviceType].apiTypes.find(A => api instanceof A))
      throw new Error(`Service "${serviceType}" does not support API type "${endpoint.type}".`);
    // Create a new instance of service.
    const id = getNextId(name, Object.keys(this.#instances));
    const record = this.#services[serviceType];
    return this.#instances[id] = {
      id,
      serviceType,
      service: new record.serviceType(name, api),
      viewType: record.viewType,
    };
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
