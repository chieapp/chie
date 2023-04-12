import Serializable from '../model/serializable';
import WebAPI from './web-api';
import apiManager from '../controller/api-manager';

export interface WebServiceOptions {
  params?: Record<string, string>;
}

export default class WebService<T extends WebAPI> implements Serializable {
  name: string;
  api: T;
  options: WebServiceOptions;

  static deserialize(data: object): WebService<WebAPI> {
    if (!data ||
        typeof data != 'object' ||
        typeof data['name'] != 'string' ||
        typeof data['api'] != 'string') {
      throw new Error(`Unknown WebService : ${JSON.stringify(data)}`);
    }
    const endpoint = apiManager.getEndpointById(data['api']);
    const api = apiManager.createAPIForEndpoint(endpoint);
    const options = {};
    if (typeof data['params'] == 'object')
      options['params'] = data['params'];
    return new WebService(data['name'], api, options);
  }

  constructor(name: string, api: T, options: WebServiceOptions = {}) {
    if (!name || !api)
      throw new Error('Must pass name and api to WebService');
    this.name = name;
    this.api = api;
    this.options = options;
  }

  serialize() {
    const data = {
      name: this.name,
      api: this.api.endpoint.id,
    };
    if (this.options.params)
      data['params'] = this.options.params;
    return data;
  }
}
