import gui from 'gui';

import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import app from '../controller/app';
import {style} from './browser-view';

export default class SettingsWindow extends BaseWindow {
  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: style.padding});

    const tab = gui.Tab.create();
    tab.setStyle({flex: 1});
    this.contentView.addChildView(tab);

    const settings = gui.Container.create();
    settings.setStyle({padding: style.padding});
    tab.addPage('Settings', settings);
    settings.addChildView(this.#createAppTraySetting());
    if (process.platform == 'darwin')
      settings.addChildView(this.#createDockIconSetting());

    const apis = gui.Container.create();
    tab.addPage('APIs', apis);

    const buttonsArea = new ButtonsArea();
    this.contentView.addChildView(buttonsArea.view);
    buttonsArea.addCloseButton();

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
}
