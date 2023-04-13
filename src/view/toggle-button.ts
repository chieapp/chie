import gui from 'gui';

import SignalsOwner from '../model/signals-owner';
import {createRoundedCornerPath} from '../util/draw-utils';
import {style} from './dashboard-window';

export default class ToggleButton extends SignalsOwner {
  view: gui.Container;
  image?: gui.Image;

  onClick?: () => void;

  // States.
  hover = false;
  selected = false;

  constructor(image?: gui.Image) {
    super();
    this.view = gui.Container.create();
    this.image = image;

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
    this.view.onMouseUp = (view, event) => {
      if (this.onClick) {
        const bounds = view.getBounds();
        const pos = event.positionInView;
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= bounds.width && pos.y <= bounds.height)
          this.onClick();
      }
      return true;
    };
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    this.view.schedulePaint();
  }

  #onDraw(view: gui.Container, painter: gui.Painter) {
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, style.buttonRadius);
    painter.clip();

    if (this.image) {
      painter.drawImage(this.image, bounds);
    } else {
      painter.setFillColor('#A3A3A3');
      painter.fillRect(bounds);
      painter.drawText('?', bounds, {
        font: gui.Font.create('Helvetica', 30, 'normal', 'normal'),
        color: '#FFF',
        align: 'center',
        valign: 'center',
      });
    }

    // Transparent mask.
    if (!this.selected) {
      painter.setFillColor('#8FFF');
      painter.fillRect(bounds);
    }
  }
}
