import APICredential from '../model/api-credential';
import BaseView, {BaseViewType} from '../view/base-view';
import Param from '../model/param';
import WebAPI from '../model/web-api';
import WebService, {WebServiceOptions, WebServiceType} from '../model/web-service';
import apiManager, {sortByPriority} from '../controller/api-manager';
import {Selection} from '../model/param';
import {deepAssign, matchClass} from '../util/object-utils';

type WebAPIType = (new (credential) => WebAPI) | (abstract new (credential) => WebAPI);

export type ServiceRecord = {
  name?: string,
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
    const name = record.name ?? record.serviceClass.name;
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

  unregisterService(arg: string | WebServiceType) {
    const name = typeof arg == 'string' ? arg : arg.name;
    if (!(name in this.#services))
      throw new Error(`There is no service named "${name}".`);
    const serviceClass = this.#services[name].serviceClass;
    const assistantManager = require('./assistant-manager').default;
    if (assistantManager.getAssistants().find(a => a.service instanceof serviceClass))
      throw new Error(`Can not unregister service "${name}" because there is an assistant using it.`);
    delete this.#services[name];
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

  unregisterView(viewClass: BaseViewType) {
    if (!this.#views.includes(viewClass))
      throw new Error(`There is no View named "${viewClass.name}".`);
    const assistantManager = require('./assistant-manager').default;
    if (assistantManager.getAssistants().find(a => a.viewClass == viewClass))
      throw new Error(`Can not unregister View "${viewClass.name}" because there is an assistant using it.`);
    this.#views.splice(this.#views.indexOf(viewClass), 1);
  }

  getRegisteredViews() {
    return this.#views;
  }

  getViewSelections(): Selection[] {
    return this.#views.map(v => ({name: v.name, value: v}));
  }

  createService(name: string, serviceName: string, credential: APICredential, options?: Partial<WebServiceOptions>): WebService {
    if (!(serviceName in this.#services))
      throw new Error(`Service with name "${serviceName}" does not exist.`);
    // Do runtime check of API type compatibility.
    const {icon, apiClass} = apiManager.getAPIRecord(credential.type);
    const {apiClasses, serviceClass} = this.#services[serviceName];
    if (!apiClasses.find(A => matchClass(A, apiClass)))
      throw new Error(`Service "${serviceName}" does not support API type "${credential.type}".`);
    // Create service.
    const serviceOptions = deepAssign({name, api: new apiClass(credential), icon}, options);
    return new serviceClass(serviceOptions);
  }
}

export default new ServiceManager;
