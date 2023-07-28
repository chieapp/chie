import fs from 'node:fs';
import gui from 'gui';
import path from 'node:path';

import BaseWindow from '../view/base-window';
import basicStyle from '../view/basic-style';

export default class AboutWindow extends BaseWindow {
  constructor() {
    super();

    const packageJson = require('../../package.json');
    let iconPath = path.join(__dirname, '../../assets/icons/icon');
    if (packageJson.version.endsWith('-dev'))
      iconPath += '-dev';
    const icon = gui.Image.createFromPath(fs.realpathSync(iconPath + '@2x.png'));

    const imageView = gui.GifPlayer.create();
    imageView.setImage(icon);
    this.contentView.addChildView(imageView);
    const title = gui.Label.create(packageJson.build.productName);
    title.setFont(gui.Font.default().derive(1, 'bold', 'normal'));
    this.contentView.addChildView(title);
    const smallFont = gui.Font.default().derive(-3, 'normal', 'normal');
    const version = gui.Label.create(`Version ${packageJson.version}`);
    version.setFont(smallFont);
    this.contentView.addChildView(version);
    const copyright = gui.Label.create(packageJson.build.copyright);
    copyright.setFont(smallFont);
    this.contentView.addChildView(copyright);

    this.contentView.setStyle({
      alignItems: 'center',
      padding: basicStyle.padding,
      gap: basicStyle.padding / 2,
    });
    this.resizeToFitContentView();
    this.window.setResizable(false);
    this.window.setMinimizable(false);
  }

  saveState() {
    return null;  // do not remember state
  }
}
