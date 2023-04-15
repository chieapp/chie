import gui from 'gui';
import path from 'node:path';
import {realpathSync} from 'node:fs';
import Clickable from './clickable';

const buttonRadius = 8;

const style = {
  light: {
    buttonHoverColor: '#E0E0E0',
    buttonPressedColor: '#B0B0B0',
  },
  dark: {
    buttonHoverColor: '#5F5F5F',
    buttonPressedColor: '#AFAFAF',
  },
};

const assetsDir = path.join(__dirname, '../../assets');

export default class IconButton extends Clickable {
  // Stock images.
  static stockImage: Record<string, gui.Image> = {};

  image: gui.Image;
  imageSize: gui.SizeF;

  // Force using specified color mode.
  colorMode?: 'dark' | 'light';

  // Alternative images.
  imageDisabled?: gui.Image;
  imageDarkMode?: gui.Image;
  imageDarkModeDisabled?: gui.Image;

  constructor(image: gui.Image | string) {
    super();
    this.setImage(image);
  }

  setImage(image: gui.Image | string) {
    if (image instanceof gui.Image) {
      this.image = image;
    } else {
      if (!IconButton.stockImage[image])
        IconButton.stockImage[image] = gui.Image.createFromPath(realpathSync(path.join(assetsDir, 'icons', `${image}@2x.png`)));
      this.image = IconButton.stockImage[image];
    }
    this.imageSize = this.image.getSize();
    this.view.setStyle({
      width: this.imageSize.width + buttonRadius,
      height: this.imageSize.height + buttonRadius,
    });
    this.imageDisabled = this.imageDarkMode = this.imageDarkModeDisabled = null;
    this.view.schedulePaint();
  }

  onDraw(view, painter: gui.Painter) {
    const colorMode = this.colorMode ?? (this.darkMode ? 'dark' : 'light');
    const bounds = view.getBounds();
    // Round background on hover.
    if (this.enabled && (this.hover || this.pressed)) {
      painter.beginPath();
      painter.arc(
        {x: bounds.width / 2, y: bounds.height / 2},
        (this.imageSize.width + buttonRadius) / 2,
        0,
        2 * Math.PI);
      if (this.pressed)
        painter.setFillColor(style[colorMode].buttonPressedColor);
      else if (this.hover)
        painter.setFillColor(style[colorMode].buttonHoverColor);
      painter.fill();
    }
    // Button image.
    bounds.x = (bounds.width - this.imageSize.width) / 2;
    bounds.y = (bounds.height - this.imageSize.height) / 2;
    bounds.width = this.imageSize.width;
    bounds.height = this.imageSize.height;
    painter.drawImage(this.#getImageToDraw(colorMode), bounds);
  }

  #getImageToDraw(colorMode: 'dark' | 'light') {
    if (colorMode == 'dark') {
      if (!this.imageDarkMode)
        this.imageDarkMode = this.image.tint('#FFF');
      if (this.enabled) {
        return this.imageDarkMode;
      } else {
        if (!this.imageDarkModeDisabled)
          this.imageDarkModeDisabled = this.imageDarkMode.tint('#666');
        return this.imageDarkModeDisabled;
      }
    } else {
      if (this.enabled) {
        return this.image;
      } else {
        if (!this.imageDisabled)
          this.imageDisabled = this.image.tint('#AAA');
        return this.imageDisabled;
      }
    }
  }
}
