import Serializable from './serializable';

export type APIEndpointType = string;

export default class APIEndpoint implements Serializable {
  id?: string;

  type: APIEndpointType;
  name: string;
  url: string;
  key: string;
  params: Record<string, string>;

  constructor(config: object) {
    this.deserialize(config);
  }

  deserialize(config: object) {
    if (!config ||
        typeof config != 'object' ||
        typeof config['type'] != 'string' ||
        typeof config['name'] != 'string' ||
        typeof config['url'] != 'string' ||
        typeof config['key'] != 'string') {
      throw new Error(`Unknown APIEndpoint : ${JSON.stringify(config)}`);
    }
    this.type = config['type'];
    this.name = config['name'];
    this.url = config['url'];
    this.key = config['key'];
    if ('params' in config) {
      if (typeof config['params'] != 'object')
        throw new Error('The params of APIEndpoint must be Record');
      this.params = config['params'] as Record<string, string>;
    }
  }

  serialize() {
    return {
      type: this.type.toString(),
      name: this.name,
      url: this.url,
      key: this.key,
      params: this.params,
    };
  }
}
