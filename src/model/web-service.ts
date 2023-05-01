import {Signal} from 'typed-signals';

import Icon from '../model/icon';
import Serializable from '../model/serializable';
import WebAPI from './web-api';
import apiManager from '../controller/api-manager';

export interface WebServiceData {
  name: string;
  api: string;
  icon?: string;
  params?: Record<string, string>;
}

export interface WebServiceOptions<T extends WebAPI> {
  name: string;
  api: T;
  icon?: Icon;
  params?: Record<string, string>;
}

export default class WebService<T extends WebAPI> implements Serializable {
  onChangeName: Signal<() => void> = new Signal;
  onChangeParams: Signal<() => void> = new Signal;
  onChangeIcon: Signal<() => void> = new Signal;

  name: string;
  api: T;
  icon?: Icon;

  static deserialize(data: WebServiceData): WebServiceOptions<WebAPI> {
    if (!data ||
        typeof data != 'object' ||
        typeof data.name != 'string' ||
        typeof data.api != 'string') {
      throw new Error(`Unknown WebService : ${JSON.stringify(data)}`);
    }
    const endpoint = apiManager.getEndpointById(data.api);
    const api = apiManager.createAPIForEndpoint(endpoint);
    const options: WebServiceOptions<WebAPI> = {name: data.name, api};
    if (typeof data.icon == 'string')
      options.icon = new Icon({chieURL: data.icon});
    if (typeof data.params == 'object')
      options.params = data.params;
    return options;
  }

  constructor(options: WebServiceOptions<T>) {
    if (!options.name || !options.api)
      throw new Error('Must pass name and api to WebService');
    this.name = options.name;
    this.api = options.api;
    this.icon = options.icon ?? new Icon({name: 'bot'});
    this.api.params = options.params;
  }

  serialize() {
    const data: WebServiceData = {
      name: this.name,
      api: this.api.endpoint.id,
    };
    if (this.icon)
      data.icon = this.icon.getChieURL();
    if (this.api.params && Object.keys(this.api.params).length > 0)
      data.params = this.api.params;
    return data;
  }

  destructor() {
    // Nothing to destructor by default.
  }

  setName(name: string) {
    if (this.name == name)
      return false;
    this.name = name;
    this.onChangeName.emit();
    return true;
  }

  setParam(name: string, value: string) {
    if (!this.api.params)
      this.api.params = {};
    if (this.api.params[name] == value)
      return false;
    this.api.params[name] = value;
    this.onChangeParams.emit();
    return true;
  }

  setParams(params: Record<string, string>) {
    if (this.api.params == params)
      return false;
    if (this.api.params && deepEqual(this.api.params, params))
      return false;
    this.api.params = params;
    this.onChangeParams.emit();
    return true;
  }
}

export interface WebServiceType<T extends WebAPI> {
  new (options: WebServiceOptions<T>): WebService<T>;
  deserialize(config: object): WebServiceOptions<T>;
}

function deepEqual(a: Record<string, string>, b: Record<string, string>) {
  return Object.keys(a).every(k => Object.prototype.hasOwnProperty.call(b, k) && a[k] == b[k]) &&
         Object.keys(b).every(k => Object.prototype.hasOwnProperty.call(a, k));
}
