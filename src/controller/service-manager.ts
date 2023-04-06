import APIEndpoint from '../model/api-endpoint';
import Instance, {BaseViewType, WebServiceType} from '../model/instance';
import Serializable from '../model/serializable';
import WebAPI from '../model/web-api';
import apiManager from './api-manager';
import {getNextId} from '../util/id-generator';

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

type ServiceRecord = {
  serviceType: WebServiceType,
  apiTypes: WebAPIType[],
  viewTypes: BaseViewType[],
};

export class ServiceManager implements Serializable {
  #services: Record<string, ServiceRecord> = {};
  #instances: Record<string, Instance> = {};

  constructor() {
    const {config} = require('../controller/config-store');
    config.items['services'] = this;
  }

  deserialize(config: object) {
    if (!config)  // accepts empty config
      config = {};
    if (typeof config != 'object')
      throw new Error(`Unknown config for "services": ${config}`);
  }

  serialize() {
    const plain = {};
    return plain;
  }

  registerService(name: string, record: ServiceRecord) {
    if (name in this.#services)
      throw new Error(`Service with name ${name} has already been registered.`);
    this.#services[name] = record;
  }

  createInstance(name: string, serviceName: string, endpoint: APIEndpoint, viewType: BaseViewType) {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    const api = apiManager.createAPIForEndpoint(WebAPI, endpoint);
    if (!this.#services[serviceName].apiTypes.find(A => api instanceof A))
      throw new Error(`Service "${serviceName}" does not support API type "${endpoint.type}".`);
    const id = getNextId(name, Object.keys(this.#instances));
    return this.#instances[id] = {
      name,
      serviceType: this.#services[serviceName].serviceType,
      api,
      viewType,
    };
  }
}

export default new ServiceManager;
