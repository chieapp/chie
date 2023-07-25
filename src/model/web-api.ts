import APICredential from '../model/api-credential';

export default abstract class WebAPI {
  credential: APICredential;
  // Override the params of credential.
  params?: Record<string, string>;

  constructor(credential: APICredential) {
    this.credential = credential;
  }

  getParam(name: string) {
    if (this.params && name in this.params)
      return this.params[name];
    if (this.credential.params)
      return this.credential.params[name];
    return undefined;
  }

  clone() {
    const apiManager = require('../controller/api-manager').default;
    return apiManager.createAPIForCredential(this.credential);
  }
}
