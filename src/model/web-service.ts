import Serializable from '../model/serializable';
import WebAPI from './web-api';
import apiManager from '../controller/api-manager';

export default class WebService<T extends WebAPI> implements Serializable {
  name: string;
  api: T;

  static deserialize(config: object): WebService<WebAPI> {
    if (!config ||
        typeof config != 'object' ||
        typeof config['name'] != 'string' ||
        typeof config['api'] != 'string') {
      throw new Error(`Unknown WebService : ${JSON.stringify(config)}`);
    }
    const endpoint = apiManager.getEndpointById(config['api']);
    const api = apiManager.createAPIForEndpoint(endpoint);
    return new WebService(config['name'], api);
  }

  constructor(name: string, api: T) {
    if (!name || !api)
      throw new Error('Must pass name and api to WebService');
    this.name = name;
    this.api = api;
  }

  serialize() {
    return {
      name: this.name,
      api: this.api.endpoint.id,
    };
  }
}
