import gui from 'gui';

import Clickable from '../view/clickable';
import stockIcons from '../controller/stock-icons';
import {createCirclePath, createRoundedCornerPath} from '../util/draw-utils';

const buttonRadius = 4;

const style = {
  light: {
    color: '#333',
    buttonHoverColor: '#E0E0E0',
    buttonPressedColor: '#B0B0B0',
  },
  dark: {
    color: '#EEE',
    buttonHoverColor: '#5F5F5F',
    buttonPressedColor: '#AFAFAF',
  },
};

export default class IconButton extends Clickable {
  name: string;
  title?: string;
  attributedText?: gui.AttributedText;
  imageSize: gui.SizeF;

  // Force using specified color mode.
  colorMode?: 'dark' | 'light';

  constructor(name: string) {
    super();
    this.setImage(name);
    this.view.setStyle({
      width: this.imageSize.width + buttonRadius * 2,
      height: this.imageSize.height + buttonRadius * 2,
    });
  }

  setImage(name: string) {
    if (this.name == name)
      return;
    this.name = name;
    this.imageSize = stockIcons.getImage(name).getSize();
    this.view.schedulePaint();
  }

  setTitle(title: string) {
    const colorMode = this.colorMode ?? (this.darkMode ? 'dark' : 'light');
    this.title = title;
    this.attributedText = gui.AttributedText.create(title, {
      color: style[colorMode].color,
      valign: 'center',
    });
    const bounds = this.attributedText.getBoundsFor({width: 10000, height: 1000});
    this.view.setStyle({
      width: this.imageSize.width + bounds.width + buttonRadius * 3,
    });
    this.view.schedulePaint();
  }

  onColorSchemeChange() {
    super.onColorSchemeChange();
    if (this.title)
      this.setTitle(this.title);  // update title color.
  }

  onDraw(view, painter: gui.Painter) {
    const colorMode = this.colorMode ?? (this.darkMode ? 'dark' : 'light');
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    // Round background on hover.
    if (this.enabled && (this.hover || this.pressed)) {
      if (this.attributedText) {
        createRoundedCornerPath(painter, bounds, buttonRadius);
      } else {
        createCirclePath(
          painter,
          {x: bounds.width / 2, y: bounds.height / 2},
          this.imageSize.width / 2 + buttonRadius);
      }
      if (this.pressed)
        painter.setFillColor(style[colorMode].buttonPressedColor);
      else if (this.hover)
        painter.setFillColor(style[colorMode].buttonHoverColor);
      painter.fill();
    }
    // Button image.
    const imageBounds = Object.assign({x: buttonRadius, y: buttonRadius}, this.imageSize);
    painter.drawImage(stockIcons.getTintedImage(this.name, colorMode, this.enabled), imageBounds);
    // Title.
    if (this.attributedText) {
      const x = this.imageSize.width + 2 * buttonRadius;
      painter.drawAttributedText(this.attributedText, {x, y: 0, width: bounds.width - x, height: bounds.height});
    }
  }
}
