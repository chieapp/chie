import Serializable from './serializable';

export default class APIEndpoint implements Serializable {
  id?: string;
  type: string;
  name: string;
  url: string;
  key?: string;
  params?: Record<string, string>;

  static deserialize(data: Partial<APIEndpoint>): APIEndpoint {
    if (!data ||
        typeof data != 'object' ||
        typeof data.type != 'string' ||
        typeof data.name != 'string' ||
        typeof data.url != 'string') {
      throw new Error(`Unknown APIEndpoint : ${JSON.stringify(data)}`);
    }
    if ('params' in data) {
      if (typeof data.params != 'object')
        throw new Error('The params of APIEndpoint must be Record');
    }
    return new APIEndpoint(data);
  }

  constructor(init: Partial<APIEndpoint>) {
    Object.assign(this, init);
  }

  serialize() {
    const data = {type: this.type, name: this.name, url: this.url};
    if (this.key)
      data['key'] = this.key;
    if (this.params)
      data['params'] = this.params;
    return data;
  }
}
