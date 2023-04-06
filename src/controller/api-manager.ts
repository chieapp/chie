import APIEndpoint from '../model/api-endpoint';
import WebAPI from '../model/web-api';
import {ConfigStoreItem} from './config-store';
import {getNextId} from '../util/id-generator';

type WebAPIType = new (endpoint: APIEndpoint) => WebAPI;

export class APIManager implements ConfigStoreItem {
  #apis: Record<string, WebAPIType> = {};
  #endpoints: Record<string, APIEndpoint> = {};

  constructor() {
    const {config} = require('../controller/config-store');
    config.items['apis'] = this;
  }

  deserialize(config: object) {
    if (!config)  // accepts empty config
      config = {};
    if (typeof config != 'object')
      throw new Error(`Unknown config for "apis": ${config}`);
    this.#endpoints = {};
    for (const id in config)
      this.#endpoints[id] = APIEndpoint.deserialize(config[id]);
  }

  serialize() {
    const plain = {};
    for (const id in this.#endpoints)
      plain[id] = this.#endpoints[id].serialize();
    return plain;
  }

  registerAPI(name: string, type: WebAPIType) {
    if (name in this.#apis)
      throw new Error(`API with name ${name} has already been registered.`);
    this.#apis[name] = type;
  }

  createAPIForEndpoint(endpoint: APIEndpoint) {
    if (!(endpoint.type in this.#apis))
      throw new Error(`Unable to find API implementation for endpoint ${endpoint.type}`);
    return new this.#apis[endpoint.type](endpoint);
  }

  addEndpoint(endpoint: APIEndpoint) {
    if (endpoint.id)
      throw new Error('Re-adding a managed APIEndpoint.');
    endpoint.id = getNextId(endpoint.name, Object.keys(this.#endpoints));
    this.#endpoints[endpoint.id] = endpoint;
    return endpoint.id;
  }

  removeEndpoint(id: string) {
    if (!(id in this.#endpoints))
      throw new Error(`Removing unknown API id: ${id}`);
    this.#endpoints[id].id = null;
    delete this.#endpoints[id];
  }

  getEndpointById(id: string) {
    if (!(id in this.#endpoints))
      throw new Error(`Getting unknown API id: ${id}`);
    return this.#endpoints[id];
  }

  getEndpointsByType(type: string): APIEndpoint[] {
    return Object.keys(this.#endpoints)
      .filter(k => this.#endpoints[k].type == type)
      .map(k => this.#endpoints[k]);
  }
}

export default new APIManager;
