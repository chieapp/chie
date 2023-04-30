import gui from 'gui';

import Icon from '../model/icon';

class StockIcons {
  stock: Record<string, Icon> = {};
  tinted: Record<string, gui.Image> = {};

  getImage(name: string) {
    if (!(name in this.stock))
      this.stock[name] = new Icon({name: name + '@2x'});
    return this.stock[name].getImage();
  }

  getTintedImage(name: string, colorMode: 'light' | 'dark' = 'light', enabled: boolean = true) {
    if (colorMode == 'light' && enabled)  // default mode
      return this.getImage(name);
    const key = `${name}:${colorMode}:${enabled ? 'enable' : 'disable'}`;
    if (!(key in this.tinted)) {
      let tintColor;
      if (colorMode == 'dark')
        tintColor = enabled ? '#EEE' : '#666';
      else
        tintColor = enabled ? '#000' : '#AAA';
      this.tinted[key] = this.getImage(name).tint(tintColor);
    }
    return this.tinted[key];
  }
}

export default new StockIcons();
