import gui from 'gui';
import AppearanceAware from '../model/appearance-aware';

export const buttonRadius = 8;

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

export default class IconButton extends AppearanceAware {
  image: gui.Image;
  imageSize: gui.SizeF;
  onClick?: () => void;

  // States.
  hover = false;
  pressed = false;
  enabled = true;

  // Alternative images.
  imageDisabled?: gui.Image;
  imageDarkMode?: gui.Image;
  imageDarkModeDisabled?: gui.Image;

  constructor(image: gui.Image) {
    super();

    this.setImage(image);
    this.view.setMouseDownCanMoveWindow(false);
    this.view.onDraw = this.#onDraw.bind(this);
    this.view.onMouseEnter = () => {
      this.hover = true;
      this.view.schedulePaint();
    };
    this.view.onMouseLeave = () => {
      this.hover = false;
      this.view.schedulePaint();
    };
    this.view.onMouseDown = () => {
      this.pressed = true;
      this.view.schedulePaint();
    };
    this.view.onMouseUp = (view, event) => {
      if (this.enabled && this.onClick) {
        const bounds = view.getBounds();
        const pos = event.positionInView;
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= bounds.width && pos.y <= bounds.height)
          this.onClick();
      }
      this.pressed = false;
      this.view.schedulePaint();
    };
  }

  setImage(image: gui.Image) {
    this.image = image;
    this.imageSize = image.getSize();
    this.imageDisabled = this.imageDarkMode = this.imageDarkModeDisabled = null;
    this.view.schedulePaint();
  }

  setEnabled(enabled: boolean) {
    if (this.enabled != enabled) {
      this.enabled = enabled;
      this.view.schedulePaint();
    }
  }

  #onDraw(view, painter: gui.Painter) {
    const bounds = view.getBounds();
    // Round background on hover.
    if (this.enabled && (this.hover || this.pressed)) {
      painter.beginPath();
      painter.arc(
        {x: bounds.width / 2, y: bounds.height / 2},
        (this.imageSize.width + buttonRadius) / 2,
        0,
        2 * Math.PI);
      const colorMode = this.darkMode ? 'dark' : 'light';
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
    painter.drawImage(this.#getImageToDraw(), bounds);
  }

  #getImageToDraw() {
    if (this.darkMode) {
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
