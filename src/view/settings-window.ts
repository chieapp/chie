import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import BaseWindow from '../view/base-window';
import EditableTable from '../view/editable-table';
import NewAPIWindow from '../view/new-api-window';
import ShortcutEditor from '../view/shortcut-editor';
import app from '../controller/app';
import apiManager from '../controller/api-manager';
import basicStyle from '../view/basic-style';
import windowManager from '../controller/window-manager';

export default class SettingsWindow extends BaseWindow {
  tab: gui.Tab;
  apisTable: EditableTable<APIEndpoint>;
  shortcutEditor: ShortcutEditor;

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

    this.tab.addPage('APIs', this.#createAPISetting());

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
    this.apisTable = new EditableTable<APIEndpoint>([
      {title: 'Type', key: 'type'},
      {title: 'Name', key: 'name'},
    ]);
    this.apisTable.view.setStyle({
      gap: basicStyle.padding,
      padding: basicStyle.padding,
    });

    this.apisTable.onRemoveRow.connect((index, endpoint) => apiManager.removeEndpointById(endpoint.id));
    this.apisTable.onEditRow.connect((index, endpoint) => {
      const win = new NewAPIWindow(endpoint);
      win.window.center();
      win.window.activate();
    });

    const addButton = this.apisTable.buttonsArea.addButton('Add');
    addButton.onClick = () => windowManager.showNamedWindow('newAPI');

    // Fill table with existing endpoints.
    const update = () => this.apisTable.setData(apiManager.getEndpoints());
    update();
    this.connections.add(apiManager.onAddEndpoint.connect(update));
    this.connections.add(apiManager.onUpdateEndpoint.connect(update));
    this.connections.add(apiManager.onRemoveEndpoint.connect(update));

    return this.apisTable.view;
  }
}
