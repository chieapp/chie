import WebAPI from './web-api';

export default class WebService {
  name: string;
  api: WebAPI;

  constructor(name: string, api: WebAPI) {
    if (!name || !api)
      throw new Error('Must pass name and api to WebService');
    this.name = name;
    this.api = api;
  }
}
