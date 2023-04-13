import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView from './base-view';
import BaseWindow from './base-window';
import Instance from '../model/instance';
import ToggleButton from './toggle-button';
import serviceManager from '../controller/service-manager';
import {createRoundedCornerPath} from '../util/draw-utils';

export const style = {
  buttonSize: 32,
  buttonRadius: 6,
  padding: 14,
  light: {
    bgColor: '#E5E5E5',
    handleColor: '#00B386',
  },
  dark: {
    bgColor: '#2C3849',
    handleColor: '#00B386',
  },
};

type InstanceView = {
  instance: Instance,
  button: ToggleButton,
  mainView: BaseView,
};

export default class DashboardWindow extends BaseWindow {
  #contentView: gui.Container;
  #sidebar: AppearanceAware;
  #views: InstanceView[] = [];
  #selectedView?: InstanceView;

  constructor() {
    super();

    this.window.onFocus = () => this.#selectedView?.mainView.onFocus();
    this.window.onClose = () => this.destructor();
    this.window.setContentSize({width: 600, height: 400});
    this.#contentView = gui.Container.create();
    this.#contentView.setStyle({flexDirection: 'row'});
    this.window.setContentView(this.#contentView);

    this.#sidebar = new AppearanceAware();
    this.#sidebar.view.onDraw = this.#onDraw.bind(this);
    this.#sidebar.view.setStyle({
      width: style.buttonSize + 2 * style.padding,
      alignItems: 'center',
    });
    this.#sidebar.setBackgroundColor(style.light.bgColor, style.dark.bgColor);
    this.#contentView.addChildView(this.#sidebar.view);

    for (const instance of serviceManager.getInstances())
      this.#createViewForInstance(instance);

    if (this.#views.length > 0)
      this.switchTo(0);
  }

  destructor() {
    for (const view of this.#views) {
      view.button.destructor();
      view.mainView.destructor();
    }
    this.#sidebar.destructor();
  }

  switchTo(index: number) {
    if (!(index in this.#views))
      throw new Error(`Invalid index: ${index}.`);
    this.#onSelect(this.#views[0]);
  }

  #createViewForInstance(instance: Instance) {
    // Create a button in sidebar.
    const button = new ToggleButton(instance.service.api.icon.getImage());
    button.view.setStyle({
      marginTop: style.padding,
      width: style.buttonSize,
      height: style.buttonSize,
    });
    this.#sidebar.view.addChildView(button.view);
    // Create the service's view.
    const mainView = new (instance.viewType)(instance.service);
    mainView.view.setVisible(false);
    mainView.view.setStyle({flex: 1});
    this.#contentView.addChildView(mainView.view);
    const view = {instance, button, mainView};
    this.#views.push(view);
    button.onClick = this.#onSelect.bind(this, view);
  }

  #onSelect(view: InstanceView) {
    if (this.#selectedView == view)
      return;
    // Switch button state.
    view.button.setSelected(true);
    this.#selectedView?.button.setSelected(false);
    this.#sidebar.view.schedulePaint();
    // Switch view.
    this.#selectedView?.mainView.view.setVisible(false);
    view.mainView.view.setVisible(true);
    view.mainView.initAsMainView();
    this.#selectedView = view;
  }

  #onDraw(view: gui.Container, painter: gui.Painter) {
    if (!this.#selectedView)
      return;
    // Draw a handle indicating selected state.
    const bounds = {x: -4, y: 0, width: 8, height: style.buttonSize};
    bounds.y = this.#selectedView.button.view.getBounds().y;
    createRoundedCornerPath(painter, bounds, style.buttonRadius);
    const theme = this.#sidebar.darkMode ? style.dark : style.light;
    painter.setFillColor(theme.handleColor);
    painter.fill();
  }
}
