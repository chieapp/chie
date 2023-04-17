import BaseView from '../view/base-view';
import WebAPI from './web-api';
import WebService from './web-service';

export type BaseViewType = new (service) => BaseView<WebService<WebAPI>>;

// Describes an instance of service.
export default interface Instance {
  id?: string;
  serviceName: string;
  service: WebService<WebAPI>;
  viewType: BaseViewType;
}
