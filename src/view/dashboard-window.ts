import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView, {ViewState} from './base-view';
import BaseWindow, {WindowState} from './base-window';
import IconButton from '../view/icon-button';
import Instance from '../model/instance';
import ToggleButton from './toggle-button';
import serviceManager from '../controller/service-manager';
import {createRoundedCornerPath} from '../util/draw-utils';
import {getWindowManager} from './base-menu-bar';

export const style = {
  buttonSize: 32,
  buttonRadius: 6,
  padding: 14,
  light: {
    bgColor: '#E5E5E5',
    handleColor: '#00B386',
  },
  dark: {
    bgColor: '#454545',
    handleColor: '#00B386',
  },
};

type InstanceView = {
  instance: Instance,
  button: ToggleButton,
  mainView: BaseView,
};

interface DashboardState extends WindowState {
  selected?: string;
  views?: ViewState[];
}

export default class DashboardWindow extends BaseWindow {
  views: InstanceView[] = [];
  selectedView?: InstanceView;

  #sidebar: AppearanceAware;
  #addButton: IconButton;

  constructor() {
    super({showMenuBar: true, useClassicBackground: true});

    this.window.onFocus = () => this.selectedView?.mainView.onFocus();
    this.window.setContentSize({width: 600, height: 400});
    this.contentView.setStyle({flexDirection: 'row'});

    this.#sidebar = new AppearanceAware();
    this.#sidebar.view.onDraw = this.#onDraw.bind(this);
    this.#sidebar.view.setStyle({
      width: style.buttonSize + 2 * style.padding,
      alignItems: 'center',
    });
    this.#sidebar.setBackgroundColor(style.light.bgColor, style.dark.bgColor);
    this.contentView.addChildView(this.#sidebar.view);

    this.#addButton = new IconButton('add');
    this.#addButton.view.setTooltip('Add new assistant');
    this.#addButton.view.setStyle({marginTop: style.padding});
    this.#addButton.onClick = () => getWindowManager().showNewAssistantWindow();
    this.#sidebar.view.addChildView(this.#addButton.view);

    for (const instance of serviceManager.getInstances())
      this.#createViewForInstance(instance);
    this.connections.add(serviceManager.onRemoveInstance.connect(
      this.#removeViewForInstance.bind(this)));
    this.connections.add(serviceManager.onNewInstance.connect((instance, index) => {
      this.#createViewForInstance(instance);
      this.switchTo(index);
    }));

    if (this.views.length > 0)
      this.switchTo(0);
  }

  destructor() {
    super.destructor();
    for (const view of this.views) {
      view.button.destructor();
      view.mainView.destructor();
    }
    this.#addButton.destructor();
    this.#sidebar.destructor();
  }

  saveState(): DashboardState {
    return Object.assign(super.saveState(), {
      selected: this.selectedView?.instance.id,
      views: this.views.map(v => v.mainView.saveState()),
    });
  }

  restoreState(state: DashboardState) {
    if (state.selected) {
      const index = this.views.findIndex(v => v.instance.id == state.selected);
      if (index > -1)
        this.switchTo(index);
      else
        console.error('Can not find the selected view in DashboardState.');
    }
    if (state.views) {
      for (const i in state.views) {
        const view = this.views[i];
        if (view)
          view.mainView.restoreState(state.views[i]);
        else
          console.error('There is invalid state in DashboardState.');
      }
    }
    super.restoreState(state);
  }

  getMainView() {
    return this.selectedView?.mainView;
  }

  switchTo(index: number) {
    if (!(index in this.views))
      throw new Error(`Invalid index: ${index}.`);
    this.#onSelect(this.views[index]);
  }

  #createViewForInstance(instance: Instance) {
    // Create a button in sidebar.
    const button = new ToggleButton(instance.service.api.icon.getImage());
    button.view.setStyle({
      marginTop: style.padding,
      width: style.buttonSize,
      height: style.buttonSize,
    });
    this.#sidebar.view.addChildViewAt(button.view, this.#sidebar.view.childCount() - 1);
    // Create the service's view.
    const mainView = new (instance.viewType)(instance.service);
    mainView.view.setVisible(false);
    mainView.view.setStyle({flex: 1});
    this.contentView.addChildView(mainView.view);
    // Save them.
    const view = {instance, button, mainView};
    this.views.push(view);
    button.onClick = this.#onSelect.bind(this, view);
    button.onContextMenu = this.#onContextMenu.bind(this, view);
    mainView.connections.add(mainView.onNewTitle.connect(
      this.#onNewTitle.bind(this, view)));
  }

  #removeViewForInstance(instance: Instance) {
    const index = this.views.findIndex(v => v.instance == instance);
    if (index < 0)
      throw new Error(`Can not find view to remove for ${instance.service.name}.`);
    // If closed view is selected, move selection to siblings.
    const view = this.views[index];
    if (this.selectedView == view) {
      if (index + 1 < this.views.length)
        this.switchTo(index + 1);
      else if (index > 0)
        this.switchTo(index - 1);
      else
        this.selectedView = null;
    }
    // Destruct and remove views.
    view.button.destructor();
    view.mainView.destructor();
    this.views.splice(index, 1);
    this.contentView.removeChildView(view.mainView.view);
    this.#sidebar.view.removeChildView(view.button.view);
    this.#sidebar.view.schedulePaint();
  }

  #onSelect(view: InstanceView) {
    if (this.selectedView == view)
      return;
    // Switch button state.
    view.button.setSelected(true);
    this.selectedView?.button.setSelected(false);
    this.#sidebar.view.schedulePaint();
    // Switch view.
    this.selectedView?.mainView.view.setVisible(false);
    view.mainView.view.setVisible(true);
    view.mainView.initAsMainView();
    view.mainView.onFocus();
    // The main view size should keep unchanged when switching.
    const size = this.selectedView?.mainView.getMainViewSize();
    if (size) {
      const oldSize = this.selectedView.mainView.view.getBounds();
      const newSize = view.mainView.getSizeFromMainViewSize(size);
      if (newSize.width != oldSize.width) {
        const bounds = this.window.getBounds();
        bounds.width += newSize.width - oldSize.width;
        this.window.setBounds(bounds);
      }
    }
    this.selectedView = view;
    // Change window title.
    this.window.setTitle(view.mainView.getTitle());
  }

  #onContextMenu(view: InstanceView) {
    const menu = gui.Menu.create([
      {
        label: 'Show in new window',
        onClick: () => getWindowManager().showChatWindow(view.instance),
      },
      {
        label: 'Remove',
        onClick: () => serviceManager.removeInstanceById(view.instance.id),
      },
    ]);
    menu.popup();
  }

  #onNewTitle(view: InstanceView) {
    if (view == this.selectedView)
      this.window.setTitle(view.mainView.getTitle());
  }

  #onDraw(view: gui.Container, painter: gui.Painter) {
    if (!this.selectedView)
      return;
    // Draw a handle indicating selected state.
    const bounds = {x: -4, y: 0, width: 8, height: style.buttonSize};
    bounds.y = this.selectedView.button.view.getBounds().y;
    createRoundedCornerPath(painter, bounds, style.buttonRadius);
    const theme = this.#sidebar.darkMode ? style.dark : style.light;
    painter.setFillColor(theme.handleColor);
    painter.fill();
  }

  #getWindowManager() {
    // Delay loaded to avoid circular reference.
    return require('../controller/window-manager').default;
  }
}
