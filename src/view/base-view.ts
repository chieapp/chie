import gui from 'gui';
import {Signal} from 'typed-signals';

import AppearanceAware from '../view/appearance-aware';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export interface ViewState {
}

export default abstract class BaseView<T extends WebService<WebAPI> = WebService<WebAPI>> extends AppearanceAware {
  service: T;

  onNewTitle: Signal<() => void> = new Signal;

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

  // Save and restore states.
  saveState(): ViewState | null {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  restoreState(state: ViewState) {
    // Do nothing by default.
  }

  // Return the window title.
  getTitle(): string {
    return this.service.name;
  }

  // Return the size of the main view inside view.
  getMainViewSize(): gui.SizeF {
    return this.view.getBounds();
  }

  // Compute the size of view according to the size of main view.
  getSizeFromMainViewSize(size: gui.SizeF) {
    return size;
  }
}
