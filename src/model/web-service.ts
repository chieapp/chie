import {Signal} from 'typed-signals';

import Icon from '../model/icon';
import Serializable from '../model/serializable';
import WebAPI from './web-api';
import apiManager from '../controller/api-manager';

export interface WebServiceData {
  name: string;
  api: string;
  params?: Record<string, string>;
  icon?: string;
}

export interface WebServiceOptions<T extends WebAPI> {
  name: string;
  api: T;
  params?: Record<string, string>;
  icon?: Icon;
}

export default class WebService<T extends WebAPI> implements Serializable {
  onChangeName: Signal<() => void> = new Signal;
  onChangeParams: Signal<() => void> = new Signal;
  onChangeIcon: Signal<() => void> = new Signal;

  name: string;
  api: T;
  params?: Record<string, string>;
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
    if (typeof data.params == 'object')
      options.params = data.params;
    if (typeof data.icon == 'string')
      options.icon = new Icon({chieURL: data.icon});
    return new WebService(options);
  }

  constructor(options: WebServiceOptions<T>) {
    if (!options.name || !options.api)
      throw new Error('Must pass name and api to WebService');
    Object.assign(this, options);
    if (!options.icon)
      this.icon = new Icon({name: 'bot'});
  }

  serialize() {
    const data: WebServiceData = {
      name: this.name,
      api: this.api.endpoint.id,
    };
    if (this.params)
      data.params = this.params;
    if (this.icon)
      data.icon = this.icon.getChieURL();
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
}

export interface WebServiceType<T extends WebAPI> {
  new (options: WebServiceOptions<T>): WebService<T>;
  deserialize(config: object): WebServiceOptions<T>;
}
