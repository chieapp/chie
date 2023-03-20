import APIEndpoint from '../model/api-endpoint';
import Serializable from '../model/serializable';

class APIManager implements Serializable {
  #apis: APIEndpoint[] = [];

  constructor() {
    const {config} = require('../controller/config-store');
    config.items['apis'] = this;
  }

  serialize() {
    return this.#apis.map(api => api.serialize());
  }

  deserialize(config: object) {
    if (!config)
      return;
    if (!Array.isArray(config))
      throw new Error(`Unknown config for "apis": ${config}`);
    this.#apis = config.map(c => new APIEndpoint(c));
  }
}

export default new APIManager;
