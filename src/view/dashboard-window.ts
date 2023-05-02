import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView, {ViewState} from './base-view';
import BaseWindow, {WindowState} from './base-window';
import IconButton from '../view/icon-button';
import Instance from '../model/instance';
import NewAPIWindow from './new-api-window';
import NewAssistantWindow from './new-assistant-window';
import ToggleButton from './toggle-button';
import basicStyle from './basic-style';
import serviceManager from '../controller/service-manager';
import windowManager from '../controller/window-manager';
import {createRoundedCornerPath} from '../util/draw-utils';

export const style = {
  buttonSize: 32,
  buttonRadius: 6,
  light: {
    bgColor: '#E5E5E5',
  },
  dark: {
    bgColor: '#454545',
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

    this.window.setTitle('Dashboard');
    this.window.onFocus = () => this.selectedView?.mainView.onFocus();
    this.contentView.setStyle({flexDirection: 'row'});

    this.#sidebar = new AppearanceAware();
    this.#sidebar.view.onDraw = this.#onDraw.bind(this);
    this.#sidebar.view.setStyle({
      width: style.buttonSize + 2 * basicStyle.padding,
      alignItems: 'center',
    });
    this.#sidebar.setBackgroundColor(style.light.bgColor, style.dark.bgColor);
    this.contentView.addChildView(this.#sidebar.view);

    this.#addButton = new IconButton('add');
    this.#addButton.view.setTooltip('Add new assistant');
    this.#addButton.view.setStyle({marginTop: basicStyle.padding});
    this.#addButton.onClick = () => windowManager.showNamedWindow('newAssistant');
    this.#sidebar.view.addChildView(this.#addButton.view);

    for (const instance of serviceManager.getInstances())
      this.#createViewForInstance(instance);
    this.connections.add(serviceManager.onRemoveInstance.connect(
      this.#removeViewForInstance.bind(this)));
    this.connections.add(serviceManager.onNewInstance.connect((instance, index) => {
      this.#createViewForInstance(instance);
      this.switchTo(index);
    }));
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
    super.restoreState(state);
    if (state.views) {
      for (const i in state.views) {
        const view = this.views[i];
        if (view)
          view.mainView.restoreState(state.views[i]);
        else
          console.error('There is invalid state in DashboardState.');
      }
    }
    if (state.selected) {
      const index = this.views.findIndex(v => v.instance.id == state.selected);
      if (index > -1)
        this.switchTo(index);
      else
        console.error('Can not find the selected view in DashboardState.');
    } else if (this.views.length > 0) {
      this.switchTo(0);
    }
  }

  getMainView() {
    return this.selectedView?.mainView;
  }

  switchTo(index: number) {
    if (index < 0)  // pass -1 to select last
      index += this.views.length;
    if (!(index in this.views))
      throw new Error(`Invalid index: ${index}.`);
    this.#onSelect(this.views[index]);
  }

  #createViewForInstance(instance: Instance) {
    // Create a button in sidebar.
    const button = new ToggleButton(instance.service.icon.getImage());
    button.view.setTooltip(instance.service.name);
    button.view.setStyle({
      marginTop: basicStyle.padding,
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
    // Update button image and title on change.
    mainView.connections.add(mainView.onNewTitle.connect(() => {
      this.#onNewTitle(view);
    }));
    mainView.connections.add(instance.service.onChangeName.connect(() => {
      button.view.setTooltip(instance.service.name);
      this.#onNewTitle(view);
    }));
    mainView.connections.add(instance.service.onChangeIcon.connect(() => {
      button.setImage(instance.service.icon.getImage());
    }));
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
    this.#onNewTitle(view);
  }

  #onContextMenu(view: InstanceView) {
    const menu = gui.Menu.create([
      {
        label: 'Show in new window...',
        onClick: () => windowManager.showChatWindow(view.instance.id),
      },
      {
        label: 'Edit assistant...',
        onClick: () => {
          const win = new NewAssistantWindow(view.instance);
          win.window.center();
          win.window.activate();
        }
      },
      {
        label: 'Edit API endpoint...',
        onClick: () => {
          const win = new NewAPIWindow(view.instance.service.api.endpoint);
          win.window.center();
          win.window.activate();
        }
      },
      {type: 'separator'},
      {
        label: 'Remove',
        onClick: () => serviceManager.removeInstanceById(view.instance.id),
      },
    ]);
    menu.popup();
  }

  #onNewTitle(view: InstanceView) {
    if (view == this.selectedView) {
      let title = view.mainView.getTitle();
      if (title != view.instance.service.name)
        title = view.instance.service.name + ': ' + title;
      this.window.setTitle(title);
    }
  }

  #onDraw(view: gui.Container, painter: gui.Painter) {
    if (!this.selectedView)
      return;
    // Draw a handle indicating selected state.
    const bounds = {x: -4, y: 0, width: 8, height: style.buttonSize};
    bounds.y = this.selectedView.button.view.getBounds().y;
    createRoundedCornerPath(painter, bounds, style.buttonRadius);
    painter.setFillColor(basicStyle.accentColor);
    painter.fill();
  }
}
