import gui from 'gui';

import {style} from './browser-view';

export default class ButtonsArea {
  view = gui.Container.create();
  row = gui.Container.create();

  constructor(options: {hideSeparator?: boolean} = {}) {
    if (!options.hideSeparator) {
      this.view.setStyle({paddingTop: style.padding});
      this.view.addChildView(gui.Separator.create('horizontal'));
    }
    this.view.setStyle({justifyContent: 'flex-end'});
    this.row.setStyle({
      flexDirection: 'row-reverse',
      paddingTop: style.padding,
    });
    this.view.addChildView(this.row);
  }

  addButton(title: string): gui.Button {
    const button = gui.Button.create(title);
    button.setStyle({width: 60, height: 28});
    if (this.row.childCount() > 0)
      button.setStyle({marginRight: style.padding});
    this.row.addChildView(button);
    return button;
  }

  addCloseButton() {
    this.addButton('Close').onClick = () => this.view.getWindow()?.close();
  }
}
