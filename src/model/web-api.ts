import APIEndpoint from './api-endpoint';
import Icon from './icon';

export default abstract class WebAPI {
  icon?: Icon;
  endpoint: APIEndpoint;

  constructor(endpoint: APIEndpoint) {
    this.endpoint = endpoint;
  }
}
