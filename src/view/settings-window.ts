import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import NewAPIWindow from './new-api-window';
import alert from '../util/alert';
import app from '../controller/app';
import apiManager from '../controller/api-manager';
import windowManager from '../controller/window-manager';
import serviceManager from '../controller/service-manager';
import {style} from './browser-view';

export default class SettingsWindow extends BaseWindow {
  tab: gui.Tab;
  apisTable: gui.Table;
  addButton: gui.Button;
  editButton: gui.Button;
  removeButton: gui.Button;

  // Keep a copy of endpoints here, which maps to the ones in table.
  #endpoints: APIEndpoint[];

  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: style.padding});

    this.tab = gui.Tab.create();
    this.tab.setStyle({flex: 1});
    this.contentView.addChildView(this.tab);

    const settings = gui.Container.create();
    settings.setStyle({padding: style.padding});
    this.tab.addPage('Settings', settings);
    settings.addChildView(this.#createAppTraySetting());
    if (process.platform == 'darwin')
      settings.addChildView(this.#createDockIconSetting());

    const apis = gui.Container.create();
    apis.setStyle({padding: style.padding});
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

    this.resizeToFitContentView({width: 400, height: 400});
    this.window.setTitle('Settings');
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
    checkbox.setStyle({marginTop: style.padding / 2});
    checkbox.setChecked(app.isDockIconVisible());
    checkbox.onClick = () => {
      checkbox.setEnabled(false);
      app.setDockIconVisible(!app.isDockIconVisible());
      // Showing/hiding dock is an async operation, prevent short clicks.
      setTimeout(() => checkbox.setEnabled(true), 300);
    };
    return checkbox;
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
    const instance = serviceManager.getInstances().find(i => i.service.api.endpoint.id == id);
    if (instance) {
      alert(`Can not remove API endpoint because assistant "${instance.service.name}" is using it.`);
      return;
    }
    apiManager.removeEndpointById(id);
  }
}
