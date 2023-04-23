import gui from 'gui';

import Clickable from './clickable';
import stockIcons from '../controller/stock-icons';

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

export default class IconButton extends Clickable {
  name: string;
  imageSize: gui.SizeF;

  // Force using specified color mode.
  colorMode?: 'dark' | 'light';

  constructor(name: string) {
    super();
    this.setImage(name);
    this.view.setStyle({
      width: this.imageSize.width + buttonRadius,
      height: this.imageSize.height + buttonRadius,
    });
  }

  setImage(name: string) {
    if (this.name == name)
      return;
    this.name = name;
    this.imageSize = stockIcons.getImage(name).getSize();
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
    painter.drawImage(stockIcons.getTintedImage(this.name, colorMode, this.enabled), bounds);
  }
}
