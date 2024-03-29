import {Signal} from 'typed-signals';

import Icon from '../model/icon';
import Serializable from '../model/serializable';
import WebAPI from '../model/web-api';
import apiManager from '../controller/api-manager';
import {isEmptyObject, nonNullAssign, shallowEqual} from '../util/object-utils';

export interface WebServiceData<P extends object = object> {
  name: string;
  api: string;
  icon?: string;
  apiParams?: Record<string, string>;
  params?: P;
}

export interface WebServiceOptions<T extends WebAPI = WebAPI, P extends object = object> {
  name: string;
  api: T;
  icon?: Icon;
  apiParams?: Record<string, string>;
  params?: P;
}

export default class WebService<T extends WebAPI = WebAPI, P extends object = object> implements Serializable {
  onChangeName: Signal<() => void> = new Signal;
  onChangeAPIParams: Signal<() => void> = new Signal;
  onChangeParams: Signal<() => void> = new Signal;
  onChangeIcon: Signal<() => void> = new Signal;

  name: string;
  api: T;
  icon?: Icon;
  params?: P;

  static deserialize(data: WebServiceData): WebServiceOptions<WebAPI> {
    if (!data ||
        typeof data != 'object' ||
        typeof data.name != 'string' ||
        typeof data.api != 'string') {
      throw new Error(`Unknown WebService : ${JSON.stringify(data)}`);
    }
    const credential = apiManager.getCredentialById(data.api);
    const api = apiManager.createAPIForCredential(credential);
    const options: WebServiceOptions<WebAPI> = {name: data.name, api};
    if (typeof data.icon == 'string')
      options.icon = new Icon({chieURL: data.icon});
    if (typeof data.apiParams == 'object')
      options.apiParams = data.apiParams;
    if (typeof data.params == 'object')
      options.params = data.params;
    return options;
  }

  constructor(options: WebServiceOptions<T, P>) {
    if (!options.name || !options.api)
      throw new Error('Must pass name and api to WebService');
    this.name = options.name;
    this.api = options.api;
    this.icon = options.icon ?? new Icon({name: 'bot'});
    // The params are cloned since they may be used to create other assistants.
    this.api.params = Object.assign({}, options.apiParams);
    this.params = Object.assign({}, options.params);
  }

  serialize() {
    const data: WebServiceData = {
      name: this.name,
      api: this.api.credential.id,
    };
    if (this.icon)
      data.icon = this.icon.getChieURL();
    if (!isEmptyObject(this.api.params))
      data.apiParams = nonNullAssign({}, this.api.params);
    if (!isEmptyObject(this.params))
      data.params = nonNullAssign({}, this.params);
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

  setIcon(icon: Icon) {
    if (this.icon == icon)
      return false;
    this.icon = icon;
    this.onChangeIcon.emit();
    return true;
  }

  setAPIParam(name: string, value: string) {
    if (!this.api.params)
      this.api.params = {};
    if (this.api.params[name] == value)
      return false;
    this.api.params[name] = value;
    this.onChangeAPIParams.emit();
    return true;
  }

  setAPIParams(params: Record<string, string>) {
    if (this.api.params == params)
      return false;
    if (this.api.params && shallowEqual(this.api.params, params))
      return false;
    this.api.params = Object.assign({}, params);
    this.onChangeAPIParams.emit();
    return true;
  }

  getAPIParam(name: string) {
    return this.api.getParam(name);
  }

  setParam(name: string, value) {
    if (!this.params)
      this.params = {} as P;
    if (this.params[name] == value)
      return false;
    this.params[name] = value;
    this.onChangeParams.emit();
    return true;
  }

  setParams(params: P) {
    if (this.params == params)
      return false;
    if (this.params && shallowEqual(this.params, params))
      return false;
    this.params = Object.assign({}, params);
    this.onChangeParams.emit();
    return true;
  }

  getParam(name: string) {
    return this.params ? this.params[name] : null;
  }
}

export interface WebServiceType<T extends WebAPI = WebAPI> {
  new (options: WebServiceOptions<T>): WebService<T>;
  deserialize(config: object): WebServiceOptions<T>;
}
