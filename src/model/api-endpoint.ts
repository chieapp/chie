import Serializable from './serializable';

export enum APIEndpointType {
  ChatGPT,
}

export default class APIEndpoint implements Serializable {
  type: APIEndpointType;
  url: string;
  model?: string = null;

  constructor(config: object) {
    this.deserialize(config);
  }

  serialize() {
    return {
      type: this.type.toString(),
      url: this.url,
      model: this.model,
    };
  }

  deserialize(config: object) {
    if (!config || typeof config != 'object')
      throw new Error(`Unknown APIEndpoint: ${config}`);
    if (!(config['type'] in APIEndpointType))
      throw new Error(`Unknown APIEndpoint type: ${config['type']}`);
    this.type = config['type'];
    this.url = String(config['url']);
    if (config['model'])
      this.model = String(config['model']);
  }
}
