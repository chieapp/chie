import WebAPI from '../model/web-api';
import APIEndpoint, {APIEndpointType} from '../model/api-endpoint';
import Serializable from '../model/serializable';

type WebAPIType = new (endpoint: APIEndpoint) => WebAPI;

export class APIManager implements Serializable {
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
      this.#endpoints[id] = new APIEndpoint(config[id]);
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
    endpoint.id = this.#getNextId(endpoint.name);
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

  getEndpointsByType(type: APIEndpointType): APIEndpoint[] {
    return Object.keys(this.#endpoints)
      .filter(k => this.#endpoints[k].type == type)
      .map(k => this.#endpoints[k]);
  }

  #getNextId(name: string) {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '-';
    const ids = Object.keys(this.#endpoints)
      .filter(k => k.startsWith(prefix))  // id is in the form of "name-1"
      .map(n => parseInt(n.substr(prefix.length)))  // get the number part
      .filter(n => Number.isInteger(n))  // valid id must be integer
      .sort((a: number, b: number) => b - a);  // descend
    if (ids.length == 0)
      return prefix + '1';
    const nextId = prefix + String(ids[0] + 1);
    if (nextId in this.#endpoints)  // should not happen
      throw new Error(`Duplicate ID generated: ${nextId}`);
    return nextId;
  }
}

export default new APIManager;
