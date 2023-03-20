import Serializable from './serializable';

export enum APIEndpointType {
  ChatGPT,
}

export default class APIEndpoint implements Serializable {
  type: APIEndpointType;
  name: string;
  url: string;
  params: Record<string, string>[];

  constructor(config: object) {
    this.deserialize(config);
  }

  deserialize(config: object) {
    if (!config ||
        typeof config != 'object' ||
        !(config['type'] in APIEndpointType) ||
        typeof config['name'] != 'string' ||
        typeof config['url'] != 'string') {
      throw new Error(`Unknown APIEndpoint : ${JSON.stringify(config)}`);
    }
    this.type = config['type'];
    this.name = config['name'];
    this.url = config['url'];
    if ('params' in config) {
      if (!Array.isArray(config['params']))
        throw new Error(`The params of APIEndpoint must be array`);
      this.params = config['params'];
    }
  }

  serialize() {
    return {
      type: this.type.toString(),
      url: this.url,
      params: this.params,
    };
  }
}
