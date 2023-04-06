import BaseView from '../view/base-view';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export type BaseViewType = new (name, serviceType, api) => BaseView;
export type WebServiceType = new (name, api) => WebService;

// Describes an instance of service.
export default interface Instance {
  name: string,
  serviceType: WebServiceType;
  api: WebAPI;
  viewType: BaseViewType;
}
