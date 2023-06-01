import gui from 'gui';

import basicStyle from './basic-style';

export default class ButtonsArea {
  view = gui.Container.create();
  row = gui.Container.create();

  constructor(options: {hideSeparator?: boolean} = {}) {
    if (!options.hideSeparator) {
      const separator = gui.Separator.create('horizontal');
      separator.setStyle({marginBottom: basicStyle.padding});
      this.view.addChildView(separator);
    }
    this.view.setStyle({justifyContent: 'flex-end'});
    this.row.setStyle({flexDirection: 'row-reverse'});
    this.view.addChildView(this.row);
  }

  addButton(title: string): gui.Button {
    const button = gui.Button.create(title);
    button.setStyle({width: 70});
    if (this.row.childCount() > 0)
      button.setStyle({marginRight: basicStyle.padding});
    this.row.addChildView(button);
    return button;
  }

  addCloseButton() {
    this.addButton('Close').onClick = () => this.view.getWindow()?.close();
  }
}
