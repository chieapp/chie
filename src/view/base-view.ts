import gui from 'gui';
import {Signal} from 'typed-signals';

import AppearanceAware from '../view/appearance-aware';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';

export interface ViewState {
}

export default abstract class BaseView<T extends WebService<WebAPI> = WebService<WebAPI>> extends AppearanceAware {
  service?: T;

  onNewTitle: Signal<() => void> = new Signal;

  constructor(service?: T) {
    super();
    this.service = service;
  }

  // The view has been added as the content view of a window.
  initAsMainView() {
    // Do nothing by default.
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
type BaseViewConstructorType = new (service) => BaseView<WebService<WebAPI>>;
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
