import APIEndpoint from '../model/api-endpoint';
import Param from '../model/param';
import ParamsView from './params-view';
import {APIRecord} from '../controller/api-manager';

interface APIParamsViewOptions {
  apiRecord: APIRecord;
  showAuthParams: boolean;
  endpoint?: APIEndpoint;
}

export default class APIParamsView extends ParamsView {
  apiRecord: APIRecord;
  showAuthParams: boolean;

  constructor({apiRecord, showAuthParams, endpoint}: APIParamsViewOptions) {
    const params: Param[] = [];
    if (showAuthParams) {
      if (apiRecord.url) {
        params.push({
          name: 'url',
          type: 'string',
          readableName: 'URL',
          value: endpoint?.url ?? apiRecord.url,
        });
      }
      if (apiRecord.auth == 'key') {
        params.push({
          name: 'key',
          type: 'string',
          readableName: 'API Key',
          value: endpoint?.key,
        });
      }
      if (apiRecord.auth == 'login') {
        params.push({
          name: 'cookie',
          type: 'string',
          readableName: 'Cookie',
          value: endpoint?.cookie,
        });
      }
    }
    if (apiRecord.params)
      params.push(...apiRecord.params);

    super(params);
    this.apiRecord = apiRecord;
    this.showAuthParams = showAuthParams;

    // Fill params.
    if (endpoint?.params) {
      for (const name in endpoint.params)
        this.getView(name)?.setValue(endpoint.params[name]);
    }
  }

  readParams(): Partial<APIEndpoint> {
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
      result.params = {};
      for (const p of this.apiRecord.params) {
        const value = this.getValue(p.name);
        if (value)
          result.params[p.name] = value;
      }
    }
    return result;
  }
}
