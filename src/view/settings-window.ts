import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import {style} from './browser-view';

export default class SettingsWindow extends BaseWindow {
  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: style.padding});

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1});
    this.contentView.addChildView(buttonsArea.view);
    buttonsArea.addCloseButton();

    this.resizeToFitContentView({width: 400});
    this.window.setTitle('Settings');
  }

  saveState() {
    return null;  // do not remember state
  }
}
