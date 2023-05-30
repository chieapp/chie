import gui from 'gui';

import Clickable from '../view/clickable';
import {createRoundedCornerPath} from '../util/draw-utils';
import {style} from '../view/dashboard-window';

export default class ToggleButton extends Clickable {
  image?: gui.Image;
  selected = false;

  constructor(image?: gui.Image) {
    super();
    this.image = image;
  }

  setImage(image?: gui.Image) {
    this.image = image;
    this.view.schedulePaint();
  }

  setSelected(selected: boolean) {
    if (this.selected == selected)
      return;
    this.selected = selected;
    this.view.schedulePaint();
  }

  onDraw(view: gui.Container, painter: gui.Painter) {
    const bounds = Object.assign(view.getBounds(), {x: 0, y: 0});
    createRoundedCornerPath(painter, bounds, style.buttonRadius);
    painter.clip();

    if (this.image) {
      painter.setFillColor('#FFF');
      painter.fillRect(bounds);
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
