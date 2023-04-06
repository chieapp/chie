import AppearanceAware from '../view/appearance-aware';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export default abstract class BaseView<T extends WebService<WebAPI>> extends AppearanceAware {
  service: T;

  constructor(service: T) {
    super();
    if (!service)
      throw new Error('Must pass service to BaseView');
    this.service = service;
  }

  // The view has been added as the content view of a window.
  abstract initAsMainView();

  // Parent window gets focus.
  // This is where the input entry should get focus.
  abstract onFocus();
}
