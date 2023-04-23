import APIEndpoint from './api-endpoint';

export default abstract class WebAPI {
  endpoint: APIEndpoint;

  constructor(endpoint: APIEndpoint) {
    this.endpoint = endpoint;
  }
}
