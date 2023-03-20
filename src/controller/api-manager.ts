import APIEndpoint from '../model/api-endpoint';
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
    const id = this.#getNextId(api.name);
    this.#apis[id] = api;
    return id;
  }

  remove(id: string) {
    if (!(id in this.#apis))
      throw new Error(`Removing unknown API id: ${id}`)
    delete this.#apis[id];
  }

  getAllEndpoints() {
    return this.#apis;
  }

  #getNextId(name: string) {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '-';
    const ids = Object.keys(this.#apis)
      .filter(k => k.startsWith(prefix))  // id is in the form of "name-1"
      .map(n => parseInt(n.substr(prefix.length)))  // get the number part
      .filter(n => Number.isInteger(n))  // valid id must be integer
      .sort((a: any, b: any) => b - a);  // descend
    if (ids.length == 0)
      return prefix + '1';
    const nextId = prefix + String(ids[0] + 1);
    if (nextId in this.#apis)  // should not happen
      throw new Error(`Duplicate ID generated: ${nextId}`);
    return nextId;
  }
}

export default new APIManager;
