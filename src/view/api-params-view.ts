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
          readableName: 'URL',
          value: nullable ? undefined : apiRecord.url,
        });
      }
      if (apiRecord.auth == 'key') {
        params.push({
          name: 'key',
          type: 'string',
          readableName: 'API Key',
        });
      }
      if (apiRecord.auth == 'login') {
        params.push({
          name: 'cookie',
          type: 'string',
          readableName: 'Cookie',
        });
      }
    }
    if (apiRecord.params) {
      if (showAuthParams)
        params.push(...apiRecord.params);
      else
        params.push(...apiRecord.params.filter(p => !p.authOnly));
    }

    super(params, nullable);
    this.apiRecord = apiRecord;
    this.showAuthParams = showAuthParams;
  }

  fillEndpoint(endpoint: APIEndpoint) {
    if (endpoint.url)
      this.getView('url').setValue(endpoint.url);
    if (endpoint.key)
      this.getView('key').setValue(endpoint.key);
    if (endpoint.cookie)
      this.getView('cookie').setValue(endpoint.cookie);
    if (endpoint.params)
      this.fillParams(endpoint.params);
  }

  fillParams(params: Record<string, string>) {
    for (const name in params)
      this.getView(name)?.setValue(params[name]);
  }

  clearParams() {
    for (const name in this.views)
      this.getView(name).setValue('');
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
    if (this.apiRecord.params)
      result.params = this.readParams();
    return result;
  }

  readParams(): Record<string, string> | null {
    if (!this.apiRecord.params)
      return null;
    const params: Record<string, string> = {};
    for (const p of this.apiRecord.params) {
      const value = this.getValue(p.name);
      if (value)
        params[p.name] = value;
    }
    return params;
  }
}
