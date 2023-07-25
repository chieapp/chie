import gui from 'gui';

import Assistant from '../model/assistant';
import BaseView, {ViewState} from '../view/base-view';
import BaseWindow, {WindowState} from '../view/base-window';
import IconButton from '../view/icon-button';
import NewAPIWindow from '../view/new-api-window';
import NewAssistantWindow from '../view/new-assistant-window';
import SortableList from '../view/sortable-list';
import SplitView, {SplitViewState} from '../view/split-view';
import ToggleButton from '../view/toggle-button';
import WelcomeBoard from '../view/welcome-board';
import basicStyle from '../view/basic-style';
import assistantManager from '../controller/assistant-manager';
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

type AssistantView = {
  assistant: Assistant,
  button: ToggleButton,
  mainView: BaseView,
};

interface DashboardState extends WindowState {
  selected?: string;
  splitViewState?: SplitViewState;
  views?: ViewState[];
}

export default class DashboardWindow extends BaseWindow {
  views: AssistantView[] = [];
  selectedView?: AssistantView;

  // Most of the views are SplitView, make them have same panel width.
  #splitViewState?: SplitViewState;

  #sidebar: SortableList;
  #addButton: IconButton;
  #welcomeBoard?: WelcomeBoard;

  constructor() {
    super({showMenuBar: true, useClassicBackground: true});

    this.window.setTitle('Dashboard');
    this.window.onFocus = () => this.selectedView?.mainView.onFocus();
    this.contentView.setStyle({flexDirection: 'row'});

    this.#sidebar = new SortableList({padding: basicStyle.padding});
    this.#sidebar.view.onDraw = this.#onDraw.bind(this);
    this.#sidebar.view.setStyle({width: style.buttonSize + 2 * basicStyle.padding});
    this.#sidebar.setBackgroundColor(style.light.bgColor, style.dark.bgColor);
    this.#sidebar.onReorder.connect(assistantManager.reorderAssistant.bind(assistantManager));
    this.#sidebar.onDragging.connect(this.#sidebar.view.schedulePaint.bind(this.#sidebar.view));
    this.contentView.addChildView(this.#sidebar.view);

    this.#addButton = new IconButton('add');
    this.#addButton.view.setTooltip('Add new assistant');
    this.#addButton.onClick = () => windowManager.showNamedWindow('newAssistant');
    this.#sidebar.view.addChildView(this.#addButton.view);

    // Create views for assistants.
    for (const assistant of assistantManager.getAssistants())
      this.#createViewForAssistant(assistant);
    this.connections.add(assistantManager.onNewAssistant.connect((assistant, index) => {
      this.#createViewForAssistant(assistant);
      this.switchTo(index);
    }));
    this.connections.add(assistantManager.onRemoveAssistant.connect(
      this.#removeViewForAssistant.bind(this)));
    this.connections.add(assistantManager.onReorderAssistant.connect(
      this.#reorderViewForAssistant.bind(this)));

    // Show welcome board if there is no assistant.
    if (this.views.length == 0)
      this.#createWelcomeBoard();
  }

  destructor() {
    super.destructor();
    for (const view of this.views)
      view.mainView.destructor();
    this.#addButton.destructor();
    this.#sidebar.destructor();
    if (this.#welcomeBoard)
      this.#welcomeBoard.destructor();
  }

  saveState(): DashboardState {
    return Object.assign(super.saveState(), {
      selected: this.selectedView?.assistant.id,
      views: this.views.map(v => v.mainView.saveState()),
    });
  }

  restoreState(state: DashboardState) {
    super.restoreState(state);
    if (!state.bounds) {
      this.window.setContentSize({width: 800, height: 600});
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
    if (state.selected) {
      const index = this.views.findIndex(v => v.assistant.id == state.selected);
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

  #createViewForAssistant(assistant: Assistant) {
    // Create a button in sidebar.
    const button = new ToggleButton(assistant.service.icon.getImage());
    button.view.setTooltip(assistant.service.name);
    button.view.setStyle({
      width: style.buttonSize,
      height: style.buttonSize,
    });
    this.#sidebar.addItemAt(button, -1);
    // Create the service's view.
    const mainView = new assistant.viewClass();
    mainView.view.setVisible(false);
    mainView.view.setStyle({flex: 1});
    mainView.loadService(assistant.service);
    this.contentView.addChildView(mainView.view);
    // Save them.
    const view = {assistant, button, mainView};
    this.views.push(view);
    button.onClick = this.#onSelect.bind(this, view);
    button.onContextMenu = this.#onContextMenu.bind(this, view);
    // Update button image and title on change.
    mainView.connections.add(mainView.onNewTitle.connect(() => {
      this.#onNewTitle(view);
    }));
    mainView.connections.add(assistant.service.onChangeName.connect(() => {
      button.view.setTooltip(assistant.service.name);
      this.#onNewTitle(view);
    }));
    mainView.connections.add(assistant.service.onChangeIcon.connect(() => {
      button.setImage(assistant.service.icon.getImage());
    }));
  }

  #removeViewForAssistant(assistant: Assistant) {
    const index = this.views.findIndex(v => v.assistant == assistant);
    if (index < 0)
      throw new Error(`Can not find view to remove for ${assistant.service.name}.`);
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
    view.mainView.destructor();
    this.views.splice(index, 1);
    this.contentView.removeChildView(view.mainView.view);
    this.#sidebar.removeItem(view.button);
    this.#sidebar.view.schedulePaint();
    // Show welcome board if there is no view.
    if (!this.selectedView) {
      this.window.setTitle('Dashboard');
      this.#createWelcomeBoard();
    }
  }

  #reorderViewForAssistant(assistant: Assistant, fromIndex: number, toIndex:number) {
    const [view] = this.views.splice(fromIndex, 1);
    this.views.splice(toIndex, 0, view);
    this.#sidebar.reorderItem(fromIndex, toIndex);
    this.#sidebar.view.schedulePaint();
  }

  #createWelcomeBoard() {
    if (this.#welcomeBoard)
      return;
    this.#welcomeBoard = new WelcomeBoard();
    this.contentView.addChildView(this.#welcomeBoard.view);
  }

  #onSelect(view: AssistantView) {
    if (this.selectedView == view)
      return;
    if (this.#welcomeBoard) {
      this.contentView.removeChildView(this.#welcomeBoard.view);
      this.#welcomeBoard.destructor();
      this.#welcomeBoard = null;
    }
    // Switch button state.
    view.button.setSelected(true);
    this.selectedView?.button.setSelected(false);
    this.#sidebar.view.schedulePaint();
    // Save SplitView state.
    if (this.selectedView?.mainView instanceof SplitView)
      this.#splitViewState = SplitView.prototype.saveState.call(this.selectedView.mainView);
    // Switch view.
    this.selectedView?.mainView.view.setVisible(false);
    view.mainView.view.setVisible(true);
    view.mainView.onFocus();
    // Restore SplitView state.
    if (this.#splitViewState && view.mainView instanceof SplitView)
      SplitView.prototype.restoreState.call(view.mainView, this.#splitViewState);
    // The main view size should keep unchanged when switching views.
    const oldView = this.selectedView?.mainView;
    if (oldView && oldView.constructor != view.mainView.constructor) {
      const mainViewSize = oldView.getMainViewSize();
      const oldSize = oldView.view.getBounds();
      const newSize = view.mainView.getSizeFromMainViewSize(mainViewSize);
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

  #onContextMenu(view: AssistantView) {
    const menu = gui.Menu.create([
      {
        label: 'Show in new window...',
        onClick: () => windowManager.showChatWindow(view.assistant.id),
      },
      {
        label: 'Edit assistant...',
        onClick: () => {
          const win = new NewAssistantWindow(view.assistant);
          win.window.center();
          win.window.activate();
        }
      },
      {
        label: 'Edit API credential...',
        onClick: () => {
          const win = new NewAPIWindow(view.assistant.service.api.credential);
          win.window.center();
          win.window.activate();
        }
      },
      {type: 'separator'},
      {
        label: 'Remove',
        onClick: () => assistantManager.removeAssistantById(view.assistant.id),
      },
    ]);
    menu.popup();
  }

  #onNewTitle(view: AssistantView) {
    if (view == this.selectedView) {
      let title = view.mainView.getTitle();
      if (title != view.assistant.service.name)
        title = view.assistant.service.name + ': ' + title;
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
