import gui from 'gui';
import {Signal, SignalConnections} from 'typed-signals';

import AppearanceAware from '../view/appearance-aware';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export interface ViewState {
}

export default abstract class BaseView<T extends WebService<WebAPI> = WebService<WebAPI>> extends AppearanceAware {
  service?: T;
  protected serviceConnections: SignalConnections = new SignalConnections();

  onNewTitle: Signal<() => void> = new Signal;

  destructor() {
    super.destructor();
    this.unload();
  }

  // Load service, return false if there is nothing to do in sub-classes.
  async loadService(service: T) {
    if (this.service == service)
      return false;
    if (this.service)
      this.unload();
    this.service = service;
    return true;
  }

  // Disconnect from the service.
  unload() {
    this.service = null;
    this.serviceConnections.disconnectAll();
  }

  // Parent window gets focus.
  // This is where the input entry should get focus.
  onFocus() {
    // Do nothing by default.
  }

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

  // Return the main view the user is working on.
  getMainView(): BaseView | null {
    return null;
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

// Define the class type of BaseView with optional getMenuItems static method.
type BaseViewConstructorType = new () => BaseView;
export type MenuItemOptions<T> = {
  label: string,
  accelerator?: string,
  validate?: (view: T) => boolean,
  onClick?: (view: T) => void,
};
export interface BaseViewType extends BaseViewConstructorType {
  getMenuItems?(): MenuItemOptions<BaseView<WebService<WebAPI>>>[];
  getSubViewType?(): BaseViewType;
}
