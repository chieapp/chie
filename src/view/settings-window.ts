import gui from 'gui';

import APICredential from '../model/api-credential';
import BaseWindow from '../view/base-window';
import EditableTable from '../view/editable-table';
import Extension from '../model/extension';
import NewAPIWindow from '../view/new-api-window';
import ShortcutEditor from '../view/shortcut-editor';
import app from '../controller/app';
import apiManager from '../controller/api-manager';
import extensionManager from '../controller/extension-manager';
import basicStyle from '../view/basic-style';
import alert from '../util/alert';
import windowManager from '../controller/window-manager';

export default class SettingsWindow extends BaseWindow {
  tab: gui.Tab;
  apisTable: EditableTable<APICredential>;
  extensionsTable: EditableTable<Extension>;
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
    this.tab.addPage('Extensions', this.#createExtensionSetting());

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
    this.apisTable = new EditableTable<APICredential>([
      {title: 'Type', key: 'type'},
      {title: 'Name', key: 'name'},
    ]);
    this.apisTable.view.setStyle({
      gap: basicStyle.padding,
      padding: basicStyle.padding,
    });

    this.apisTable.onRemoveRow.connect((index, credential) => apiManager.removeCredentialById(credential.id));
    this.apisTable.onEditRow.connect((index, credential) => {
      const win = new NewAPIWindow(credential);
      win.window.center();
      win.window.activate();
    });

    const addButton = this.apisTable.buttonsArea.addButton('Add');
    addButton.onClick = () => windowManager.showNamedWindow('newAPI');

    // Fill table with existing credentials.
    const update = () => this.apisTable.setData(apiManager.getCredentials());
    update();
    this.connections.add(apiManager.onAddCredential.connect(update));
    this.connections.add(apiManager.onUpdateCredential.connect(update));
    this.connections.add(apiManager.onRemoveCredential.connect(update));

    return this.apisTable.view;
  }

  #createExtensionSetting() {
    this.extensionsTable = new EditableTable<Extension>([
      {title: 'Name', key: 'displayName'},
      {title: 'Path', key: 'dirPath'},
    ]);
    this.extensionsTable.view.setStyle({
      gap: basicStyle.padding,
      padding: basicStyle.padding,
    });

    this.extensionsTable.editButton.setVisible(false);
    this.extensionsTable.onRemoveRow.connect((index, extension) => {
      try {
        extensionManager.unregisterExternalExtension(extension.name);
      } catch (error) {
        alert(`Failed to remove extension: ${error.message}`, {window: this.window});
      }
    });

    const addButton = this.extensionsTable.buttonsArea.addButton('Add');
    addButton.onClick = () => {
      const dialog = gui.FileOpenDialog.create();
      dialog.setTitle('Load extension');
      dialog.setButtonLabel('Load');
      dialog.setOptions(gui.FileDialog.optionPickFolders);
      if (dialog.runForWindow(this.window)) {
        try {
          extensionManager.registerExternalExtension(dialog.getResults()[0]);
        } catch (error) {
          alert(`Failed to load extension: ${error.message}`, {window: this.window});
        }
      }
    };

    // Fill table with existing extensions.
    const update = () => this.extensionsTable.setData(extensionManager.getExtensions());
    this.connections.add(extensionManager.onAddExtension.connect(update));
    this.connections.add(extensionManager.onRemoveExtension.connect(update));
    update();

    return this.extensionsTable.view;
  }
}
