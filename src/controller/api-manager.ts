import {Signal} from 'typed-signals';

import APIEndpoint from '../model/api-endpoint';
import Param from '../model/param';
import WebAPI from '../model/web-api';
import {ConfigStoreItem} from '../model/config-store';
import {Selection} from '../model/param';
import {getNextId} from '../util/id-generator';

type WebAPIType = new (endpoint: APIEndpoint) => WebAPI;

type APIRecord = {
  name: string,
  apiType: WebAPIType,
  auth: 'none' | 'key' | 'login',
  url?: string,
  description?: string,
  priority?: number,
  params?: Param[],
  login?: () => Promise<Partial<APIEndpoint>>;
};

export class APIManager extends ConfigStoreItem {
  onAddEndpoint: Signal<(endpoint: APIEndpoint) => void> = new Signal();
  onUpdateEndpoint: Signal<(endpoint: APIEndpoint) => void> = new Signal();
  onRemoveEndpoint: Signal<(endpoint: APIEndpoint) => void> = new Signal();

  #apis: Record<string, APIRecord> = {};
  #endpoints: Record<string, APIEndpoint> = {};

  deserialize(data: object) {
    if (!data)  // accepts empty config
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "apis": ${data}.`);
    this.#endpoints = {};
    for (const id in data) {
      const endpoint = APIEndpoint.deserialize(data[id]);
      endpoint.id = id;
      this.#endpoints[id] = endpoint;
    }
  }

  serialize() {
    const data = {};
    for (const id in this.#endpoints)
      data[id] = this.#endpoints[id].serialize();
    return data;
  }

  registerAPI(record: APIRecord) {
    if (record.name in this.#apis)
      throw new Error(`API with name "${record.name}" has already been registered.`);
    this.#apis[record.name] = record;
  }

  getAPISelections(): Selection<APIRecord>[] {
    return Object.keys(this.#apis)
      .map(k => ({name: k, value: this.#apis[k]}))
      .sort((a, b) => {
        // Sort by priority, if no priority defined then sort by name.
        if (a.value.priority && b.value.priority)
          return b.value.priority - a.value.priority;
        else if (!a.value.priority && !b.value.priority)
          return a.name.localeCompare(b.name);
        else if (a.value.priority)
          return -1;
        else
          return 1;
      });
  }

  getAPITypeFromName(name: string) {
    if (!(name in this.#apis))
      throw new Error(`API with name "${name}" does not exist.`);
    return this.#apis[name].apiType;
  }

  createAPIForEndpoint(endpoint: APIEndpoint) {
    if (!(endpoint.type in this.#apis))
      throw new Error(`Unable to find API implementation for endpoint ${endpoint.type}.`);
    return new (this.#apis[endpoint.type].apiType)(endpoint);
  }

  addEndpoint(endpoint: APIEndpoint) {
    if (endpoint.id)
      throw new Error('Re-adding a managed APIEndpoint.');
    endpoint.id = getNextId(endpoint.name, Object.keys(this.#endpoints));
    this.#endpoints[endpoint.id] = endpoint;
    this.onAddEndpoint.emit(endpoint);
    this.saveConfig();
    return endpoint.id;
  }

  removeEndpointById(id: string) {
    if (!(id in this.#endpoints))
      throw new Error(`Removing unknown API id: ${id}.`);
    const endpoint = this.#endpoints[id];
    delete this.#endpoints[id];
    this.onRemoveEndpoint.emit(endpoint);
    this.saveConfig();
    endpoint.id = null;
  }

  getEndpoints() {
    return Object.values(this.#endpoints);
  }

  getEndpointById(id: string) {
    if (!(id in this.#endpoints))
      throw new Error(`Getting unknown API id: ${id}.`);
    return this.#endpoints[id];
  }

  getEndpointsByType(type: string): APIEndpoint[] {
    return Object.keys(this.#endpoints)
      .filter(k => this.#endpoints[k].type == type)
      .map(k => this.#endpoints[k]);
  }

  getEndpointSelections(): Selection<APIEndpoint>[] {
    return Object.values(this.#endpoints).map(v => ({name: v.name, value: v}));
  }
}

export default new APIManager;
