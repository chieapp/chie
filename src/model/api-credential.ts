import Serializable from './serializable';

export default class APICredential implements Serializable {
  id?: string;
  type: string;
  name: string;
  url?: string;
  key?: string;
  cookie?: string;
  params?: Record<string, string>;

  static deserialize(data: Partial<APICredential>): APICredential {
    if (!data ||
        typeof data != 'object' ||
        typeof data.type != 'string' ||
        typeof data.name != 'string') {
      throw new Error(`Invalid APICredential data: ${JSON.stringify(data)}`);
    }
    if ('params' in data) {
      if (typeof data.params != 'object')
        throw new Error('The params of APICredential must be Record');
    }
    return new APICredential(data);
  }

  constructor(init: Partial<APICredential>) {
    Object.assign(this, init);
  }

  serialize() {
    const data: Partial<APICredential> = {type: this.type, name: this.name, url: this.url};
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
