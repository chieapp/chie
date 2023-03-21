import APIEndpoint, {APIEndpointType} from '../model/api-endpoint';
import Serializable from '../model/serializable';

export class APIManager implements Serializable {
  #apis: Record<string, APIEndpoint> = {};

  constructor() {
    const {config} = require('../controller/config-store');
    config.items['apis'] = this;
  }

  deserialize(config: object) {
    if (!config)  // accepts empty config
      config = {};
    if (typeof config != 'object')
      throw new Error(`Unknown config for "apis": ${config}`);
    this.#apis = {};
    for (const id in config)
      this.#apis[id] = new APIEndpoint(config[id]);
  }

  serialize() {
    const plain = {};
    for (const id in this.#apis)
      plain[id] = this.#apis[id].serialize();
    return plain;
  }

  add(api: APIEndpoint) {
    if (api.id)
      throw new Error('Re-adding a managed APIEndpoint.');
    api.id = this.#getNextId(api.name);
    this.#apis[api.id] = api;
    return api.id;
  }

  remove(id: string) {
    if (!(id in this.#apis))
      throw new Error(`Removing unknown API id: ${id}`);
    this.#apis[id].id = null;
    delete this.#apis[id];
  }

  getEndpointById(id: string) {
    if (!(id in this.#apis))
      throw new Error(`Getting unknown API id: ${id}`);
    return this.#apis[id];
  }

  getEndpointsByType(type: APIEndpointType): APIEndpoint[] {
    return Object.keys(this.#apis)
      .filter(k => this.#apis[k].type == type)
      .map(k => this.#apis[k]);
  }

  #getNextId(name: string) {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '-';
    const ids = Object.keys(this.#apis)
      .filter(k => k.startsWith(prefix))  // id is in the form of "name-1"
      .map(n => parseInt(n.substr(prefix.length)))  // get the number part
      .filter(n => Number.isInteger(n))  // valid id must be integer
      .sort((a: number, b: number) => b - a);  // descend
    if (ids.length == 0)
      return prefix + '1';
    const nextId = prefix + String(ids[0] + 1);
    if (nextId in this.#apis)  // should not happen
      throw new Error(`Duplicate ID generated: ${nextId}`);
    return nextId;
  }
}

export default new APIManager;
