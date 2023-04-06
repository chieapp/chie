import Serializable from './serializable';

export default class APIEndpoint implements Serializable {
  id?: string;
  type: string;
  name: string;
  url: string;
  key?: string;
  params?: Record<string, string>;

  static deserialize(config: object): APIEndpoint {
    if (!config ||
        typeof config != 'object' ||
        typeof config['type'] != 'string' ||
        typeof config['name'] != 'string' ||
        typeof config['url'] != 'string') {
      throw new Error(`Unknown APIEndpoint : ${JSON.stringify(config)}`);
    }
    if ('params' in config) {
      if (typeof config['params'] != 'object')
        throw new Error('The params of APIEndpoint must be Record');
    }
    return new APIEndpoint(config as APIEndpoint);
  }

  constructor(init: APIEndpoint) {
    Object.assign(this, init);
  }

  serialize() {
    return this;
  }
}
