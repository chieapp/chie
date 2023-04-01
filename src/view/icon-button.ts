import gui from 'gui';

export const buttonHoverColor = '#F0F0F0';
export const buttonPressedColor = '#B0B0B0';
export const buttonRadius = 8;

export default class IconButton {
  view: gui.Container;
  image: gui.Image;
  imageSize: gui.SizeF;
  onClick?: () => void;

  // States.
  hover = false;
  pressed = false;
  enabled = true;

  constructor(image: gui.Image) {
    this.view = gui.Container.create();
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
    this.view.onMouseUp = () => {
      if (this.enabled && this.onClick)
        this.onClick();
      this.pressed = false;
      this.view.schedulePaint();
    };
  }

  setImage(image: gui.Image) {
    this.image = image;
    this.imageSize = image.getSize();
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
      if (this.pressed)
        painter.setFillColor(buttonPressedColor);
      else if (this.hover)
        painter.setFillColor(buttonHoverColor);
      painter.fill();
    }
    // Button image.
    bounds.x = (bounds.width - this.imageSize.width) / 2;
    bounds.y = (bounds.height - this.imageSize.height) / 2;
    bounds.width = this.imageSize.width;
    bounds.height = this.imageSize.height;
    painter.drawImage(this.image, bounds);
  }
}
