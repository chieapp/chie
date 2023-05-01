import APIEndpoint from './api-endpoint';

export default abstract class WebAPI {
  endpoint: APIEndpoint;
  // Override the params of endpoint.
  params?: Record<string, string>;

  constructor(endpoint: APIEndpoint) {
    this.endpoint = endpoint;
  }

  getParam(name: string) {
    if (this.params && name in this.params)
      return this.params[name];
    if (this.endpoint.params)
      return this.endpoint.params[name];
    return undefined;
  }
}
