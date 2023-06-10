import APIEndpoint from '../model/api-endpoint';
import BaseView, {BaseViewType} from '../view/base-view';
import Param from '../model/param';
import WebAPI from '../model/web-api';
import WebService, {WebServiceOptions, WebServiceType} from '../model/web-service';
import apiManager, {sortByPriority} from '../controller/api-manager';
import {Selection} from '../model/param';
import {deepAssign, matchClass} from '../util/object-utils';

type WebAPIType = (new (endpoint) => WebAPI) | (abstract new (endpoint) => WebAPI);

export type ServiceRecord = {
  serviceClass: WebServiceType,
  apiClasses: WebAPIType[],
  viewClasses: BaseViewType[],
  description?: string,
  priority?: number,
  params?: Param[],
};

export class ServiceManager {
  #services: Record<string, ServiceRecord> = {};
  #views: BaseViewType[] = [];

  registerService(record: ServiceRecord) {
    const name = record.serviceClass.name;
    if (name in this.#services)
      throw new Error(`Service "${name}" has already been registered.`);
    if (record.viewClasses.length < 1)
      throw new Error(`Found no view when registering service "${name}".`);
    if (!matchClass(WebService, record.serviceClass))
      throw new Error('The serviceClass must inherit from WebService.');
    for (const viewClass of record.viewClasses) {
      if (!this.#views.includes(viewClass))
        throw new Error(`View "${viewClass.name}" is not registered.`);
    }
    this.#services[name] = record;
  }

  getRegisteredServices() {
    return Object.values(this.#services);
  }

  getServiceSelections(): Selection[] {
    return Object.keys(this.#services).map(k => ({name: k, value: this.#services[k]})).sort(sortByPriority);
  }

  getServiceByName(name: string) {
    return this.#services[name];
  }

  registerView(viewClass: BaseViewType) {
    if (!Object.prototype.isPrototypeOf.call(BaseView, viewClass))
      throw new Error('Registered View must inherit from BaseView.');
    if (this.#views.find(v => v.name == viewClass.name))
      throw new Error(`View "${viewClass.name}" has already been registered.`);
    this.#views.push(viewClass);
  }

  getRegisteredViews() {
    return this.#views;
  }

  getViewSelections(): Selection[] {
    return this.#views.map(v => ({name: v.name, value: v}));
  }

  createService(name: string, serviceName: string, endpoint: APIEndpoint, options?: Partial<WebServiceOptions>): WebService {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    // Do runtime check of API type compatibility.
    const {icon, apiClass} = apiManager.getAPIRecord(endpoint.type);
    const {apiClasses, serviceClass} = this.#services[serviceName];
    if (!apiClasses.find(A => matchClass(A, apiClass)))
      throw new Error(`Service "${serviceName}" does not support API type "${endpoint.type}".`);
    // Create service.
    const serviceOptions = deepAssign({name, api: new apiClass(endpoint), icon}, options);
    return new serviceClass(serviceOptions);
  }
}

export default new ServiceManager;
