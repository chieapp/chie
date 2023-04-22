import Serializable from './serializable';

export default class APIEndpoint implements Serializable {
  id?: string;
  type: string;
  name: string;
  url?: string;
  key?: string;
  cookie?: string;
  params?: Record<string, string>;

  static deserialize(data: Partial<APIEndpoint>): APIEndpoint {
    if (!data ||
        typeof data != 'object' ||
        typeof data.type != 'string' ||
        typeof data.name != 'string') {
      throw new Error(`Invalid APIEndpoint data: ${JSON.stringify(data)}`);
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
    const data: Partial<APIEndpoint> = {type: this.type, name: this.name, url: this.url};
    if (this.url)
      data.url = this.url;
    if (this.key)
      data.key = this.key;
    if (this.cookie)
      data.cookie = this.cookie;
    if (this.params)
      data.params = this.params;
    return data;
  }
}
