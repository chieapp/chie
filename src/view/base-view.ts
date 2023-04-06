import AppearanceAware from '../view/appearance-aware';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export default abstract class BaseView extends AppearanceAware {
  name: string;
  serviceType: new (name, api) => WebService;
  api: WebAPI;

  constructor(name: string, serviceType: new (name, api) => WebService, api: WebAPI) {
    super();
    if (!name || !serviceType || !api)
      throw new Error('Must pass name, serviceType and api to BaseView');
    this.name = name;
    this.serviceType = serviceType;
    this.api = api;
  }

  // The view has been added as the content view of a window.
  abstract initAsMainView();

  // Parent window gets focus.
  // This is where the input entry should get focus.
  abstract onFocus();
}
