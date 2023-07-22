import APIEndpoint from '../model/api-endpoint';
import Param from '../model/param';
import ParamsView from './params-view';
import {APIRecord} from '../controller/api-manager';

interface APIParamsViewOptions {
  apiRecord: APIRecord;
  showAuthParams: boolean;
  nullable?: boolean;
}

export default class APIParamsView extends ParamsView {
  apiRecord: APIRecord;
  showAuthParams: boolean;

  constructor({apiRecord, showAuthParams, nullable}: APIParamsViewOptions) {
    const params: Param[] = [];
    if (showAuthParams) {
      if (apiRecord.url) {
        params.push({
          name: 'url',
          type: 'string',
          displayName: 'URL',
          value: nullable ? undefined : apiRecord.url,
        });
      }
      if (apiRecord.auth == 'key') {
        params.push({
          name: 'key',
          type: 'string',
          displayName: 'API Key',
        });
      }
      if (apiRecord.auth == 'login') {
        params.push({
          name: 'cookie',
          type: 'string',
          displayName: 'Cookie',
        });
      }
    }
    if (apiRecord.params) {
      if (showAuthParams)
        params.push(...apiRecord.params);
      else
        params.push(...apiRecord.params.filter(p => !p.authOnly));
    }

    super(params, {nullable});
    this.apiRecord = apiRecord;
    this.showAuthParams = showAuthParams;
  }

  fillEndpoint(endpoint: APIEndpoint) {
    if (endpoint.url)
      this.getRow('url').setValue(endpoint.url);
    if (endpoint.key)
      this.getRow('key').setValue(endpoint.key);
    if (endpoint.cookie)
      this.getRow('cookie').setValue(endpoint.cookie);
    if (endpoint.params)
      this.fillParams(endpoint.params);
  }

  readEndpoint(): Partial<APIEndpoint> {
    const result: Partial<APIEndpoint> = {};
    if (this.showAuthParams) {
      if (this.apiRecord.url)
        result.url = this.getValue('url');
      if (this.apiRecord.auth == 'key')
        result.key = this.getValue('key');
      if (this.apiRecord.auth == 'login')
        result.cookie = this.getValue('cookie');
    }
    if (this.apiRecord.params) {
      result.params = this.readParams() as Record<string, string>;
      if (this.showAuthParams) {
        delete result.params['url'];
        delete result.params['key'];
        delete result.params['cookie'];
      }
    }
    return result;
  }
}
