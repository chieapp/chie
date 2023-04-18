import WebAPI from './web-api';
import WebService from './web-service';
import {BaseViewType} from '../view/base-view';

// Describes an instance of service.
export default interface Instance {
  id?: string;
  serviceName: string;
  service: WebService<WebAPI>;
  viewType: BaseViewType;
}
