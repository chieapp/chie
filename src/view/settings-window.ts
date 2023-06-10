import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import BaseWindow from '../view/base-window';
import ButtonsArea from '../view/buttons-area';
import NewAPIWindow from '../view/new-api-window';
import ShortcutEditor from '../view/shortcut-editor';
import alert from '../util/alert';
import app from '../controller/app';
import apiManager from '../controller/api-manager';
import basicStyle from '../view/basic-style';
import windowManager from '../controller/window-manager';
import assistantManager from '../controller/assistant-manager';

export default class SettingsWindow extends BaseWindow {
  tab: gui.Tab;
  apisTable: gui.Table;
  addButton: gui.Button;
  editButton: gui.Button;
  removeButton: gui.Button;
  shortcutEditor: ShortcutEditor;

  // Keep a copy of endpoints here, which maps to the ones in table.
  #endpoints: APIEndpoint[];

  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: basicStyle.padding});

    this.tab = gui.Tab.create();
    this.tab.setStyle({flex: 1});
    this.contentView.addChildView(this.tab);

    const settings = gui.Container.create();
    settings.setStyle({
      gap: basicStyle.padding / 2,
      padding: basicStyle.padding,
    });
    this.tab.addPage('Settings', settings);
    settings.addChildView(this.#createAppTraySetting());
    if (process.platform == 'darwin')
      settings.addChildView(this.#createDockIconSetting());
    settings.addChildView(this.#createDashboardSetting());

    const apis = gui.Container.create();
    apis.setStyle({
      gap: basicStyle.padding,
      padding: basicStyle.padding,
    });
    this.tab.addPage('APIs', apis);
    this.apisTable = gui.Table.create();
    this.apisTable.setHasBorder(true);
    this.apisTable.setStyle({flex: 1});
    this.apisTable.addColumn('Type');
    this.apisTable.addColumn('Name');
    this.apisTable.onRowActivate = this.#editSelectedRow.bind(this);
    apis.addChildView(this.apisTable);

    const apiButtonsArea = new ButtonsArea({hideSeparator: true});
    this.addButton = apiButtonsArea.addButton('Add');
    this.addButton.onClick = () => windowManager.showNamedWindow('newAPI');
    this.editButton = apiButtonsArea.addButton('Edit');
    this.editButton.setEnabled(false);
    this.editButton.onClick = this.#editSelectedRow.bind(this);
    this.removeButton = apiButtonsArea.addButton('Remove');
    this.removeButton.setEnabled(false);
    this.removeButton.onClick = this.#removeSelectedRow.bind(this);
    apis.addChildView(apiButtonsArea.view);

    this.#createAPISetting();

    this.resizeToFitContentView({width: 500, height: 400});
    this.window.setTitle('Settings');
  }

  destructor() {
    super.destructor();
    this.shortcutEditor.destructor();
  }

  saveState() {
    return null;  // do not remember state
  }

  #createAppTraySetting() {
    const checkbox = gui.Button.create({
      type: 'checkbox',
      title: 'Show Tray Icon',
    });
    checkbox.setChecked(!!app.tray);
    checkbox.onClick = () => app.setHasTray(!app.tray);
    return checkbox;
  }

  #createDockIconSetting() {
    const checkbox = gui.Button.create({
      type: 'checkbox',
      title: 'Show Dock Icon',
    });
    checkbox.setChecked(app.isDockIconVisible());
    checkbox.onClick = () => {
      checkbox.setEnabled(false);
      app.setDockIconVisible(!app.isDockIconVisible());
      // Showing/hiding dock is an async operation, prevent short clicks.
      setTimeout(() => checkbox.setEnabled(true), 300);
    };
    return checkbox;
  }

  #createDashboardSetting() {
    const view = gui.Container.create();
    view.setStyle({flexDirection: 'row', alignSelf: 'flex-start', gap: 4});
    view.addChildView(gui.Label.create('Dashboard shortcut:'));
    this.shortcutEditor = new ShortcutEditor();
    this.shortcutEditor.setAccelerator(app.dashboarShortcut);
    this.shortcutEditor.onChange = () => app.setDashboardShortcut(this.shortcutEditor.accelerator);
    view.addChildView(this.shortcutEditor.view);
    return view;
  }

  #createAPISetting() {
    // Fill table with existing endpoints.
    const update = this.#updateTableWithEndpoints.bind(this);
    update();
    this.connections.add(apiManager.onAddEndpoint.connect(update));
    this.connections.add(apiManager.onUpdateEndpoint.connect(update));
    this.connections.add(apiManager.onRemoveEndpoint.connect(update));
    // Edit/Remove button are only enabled when there is a row selected.
    this.apisTable.onSelectionChange = () => {
      const hasSelection = this.apisTable.getSelectedRow() != -1;
      this.editButton.setEnabled(hasSelection);
      this.removeButton.setEnabled(hasSelection);
    };
  }

  // Refresh the table with endpoints.
  #updateTableWithEndpoints() {
    this.#endpoints = apiManager.getEndpoints();
    const model = gui.SimpleTableModel.create(2);
    for (const endpoint of this.#endpoints)
      model.addRow([endpoint.type, endpoint.name]);
    this.apisTable.setModel(model);
    // After changing model, all items are unselected.
    this.editButton.setEnabled(false);
    this.removeButton.setEnabled(false);
  }

  // Edit the selected endpoint.
  #editSelectedRow() {
    const row = this.apisTable.getSelectedRow();
    if (row == -1)
      return;
    const win = new NewAPIWindow(this.#endpoints[row]);
    win.window.center();
    win.window.activate();
  }

  // Remove the selected endpoint.
  #removeSelectedRow() {
    const row = this.apisTable.getSelectedRow();
    if (row == -1)
      return;
    const id = this.#endpoints[row].id;
    const assistant = assistantManager.getAssistants().find(i => i.service.api.endpoint.id == id);
    if (assistant) {
      alert(`Can not remove API endpoint because assistant "${assistant.service.name}" is using it.`);
      return;
    }
    apiManager.removeEndpointById(id);
  }
}
