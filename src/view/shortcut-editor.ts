import gui from 'gui';

import Clickable from '../view/clickable';
import stockIcons from '../controller/stock-icons';
import {createRoundedCornerPath} from '../util/draw-utils';

const recordText = 'Record shortcut';
const recordingText = 'Press any key...';
const allModifiers = ['Shift', 'Alt', 'Control', 'Meta'];

export default class ShortcutEditor extends Clickable {
  onChange?: () => void;
  onActivate?: () => void;

  isRecording = false;
  accelerator?: string;

  #pendingAccelerator?: string;
  #modifiers?: Set<string>;

  constructor() {
    super();
    this.view.setStyle({alignSelf: 'flex-start'});
    this.view.setFocusable(true);
    this.view.onFocusIn = this.view.schedulePaint.bind(this.view);
    this.view.onFocusOut = () => {
      this.setRecording(false);
      this.view.schedulePaint();
    };
    this.view.onKeyDown = this.onKeyDown.bind(this);
    this.view.onKeyUp = this.onKeyUp.bind(this);
    this.onClick = this.onMouseClick.bind(this);
  }

  setAccelerator(accelerator: string | null) {
    const text = gui.AttributedText.create(accelerator ?? recordText, {
      align: 'center',
      valign: 'center',
    });
    const bounds = text.getBoundsFor({width: 1000, height: 1000});
    this.view.setStyle({
      width: 180,
      maxWidth: 180,
      height: bounds.height + 8,
    });
    this.accelerator = accelerator;
    this.setRecording(false);
  }

  setRecording(recording: boolean) {
    if (this.isRecording == recording)
      return;
    this.#pendingAccelerator = null;
    this.#modifiers = new Set();
    this.isRecording = recording;
    this.view.schedulePaint();
  }

  onKeyDown(view, event: gui.KeyEvent) {
    if (event.key == 'Tab')  // do not hack Tab key
      return false;
    if (this.isRecording) {
      if (allModifiers.includes(event.key)) {
        // Pressing modifier keys should update displayed accelerator.
        this.#modifiers.add(event.key);
        this.#updatePendingAccelerator();
      } else if (event.key == 'Escape') {
        // Pressing Esc means quit.
        this.setRecording(false);
      } else {
        // Pressing other keys means confirmation.
        this.setAccelerator([...this.#modifiers, event.key.toUpperCase()].join('+'));
        this.onChange?.();
      }
    } else {
      if (event.key == 'Space')  // press button
        this.pressed = true;
      else if (event.key == 'Enter')  // submit
        this.onActivate?.();
      else  // pressing other keys have no effect when not recording
        return false;
    }
    this.view.schedulePaint();
    return true;
  }

  onKeyUp(view, event: gui.KeyEvent) {
    this.pressed = false;
    this.view.schedulePaint();
    if (event.key == 'Tab')  // do not hack Tab key
      return false;
    if (event.key == 'Escape')  // prevent Esc from closing window
      return true;
    if (this.isRecording) {
      // Releasing modifier keys should update displayed accelerator.
      if (allModifiers.includes(event.key)) {
        this.#modifiers.delete(event.key);
        this.#updatePendingAccelerator();
      }
    } else {
      if (event.key == 'Space')  // press button
        this.setRecording(true);
      else
        return false;
    }
    return true;
  }

  onMouseClick(event: gui.MouseEvent) {
    this.view.focus();
    if (!this.isRecording && this.accelerator &&
        event.positionInView.x > this.view.getBounds().width - 20) {
      // Clicked the x button.
      this.setAccelerator(null);
      this.onChange?.();
      return;
    }
    this.setRecording(!this.isRecording);
  }

  onDraw(view, painter: gui.Painter) {
    // Leave 1px edge before drawing, otherwise the lines may lose 0.5 pixel
    // when drawing along the edge.
    const bounds = view.getBounds();
    bounds.x = bounds.y = 1;
    bounds.width -=2;
    bounds.height -=2;
    // Background color.
    createRoundedCornerPath(painter, bounds, 4);
    let fillColor;
    if (this.pressed)
      fillColor = this.darkMode ? '#4FFF' : '#4000';
    else if (this.hover)
      fillColor = this.darkMode ? '#3FFF' : '#3000';
    else
      fillColor = this.darkMode ? '#1FFF' : '#1000';
    painter.setFillColor(fillColor);
    painter.fill();
    // Focus circle.
    if (view.hasFocus()) {
      createRoundedCornerPath(painter, bounds, 4);
      painter.setStrokeColor('#888');
      painter.stroke();
    }
    // Text.
    painter.drawText(this.#getText(), bounds, {align: 'center', valign: 'center'});
    // Button.
    if (!this.isRecording && this.accelerator) {
      const icon = stockIcons.getTintedImage('stop', this.darkMode ? 'dark' : 'light', true);
      const size = icon.getSize();
      const imageBounds = Object.assign(size, {
        x: bounds.width - size.width - 2,
        y: (bounds.height - size.height) / 2 + 1,
      });
      painter.drawImage(icon, imageBounds);
    }
  }

  #getText() {
    if (!this.isRecording)
      return this.accelerator ?? recordText;
    return this.#pendingAccelerator ?? recordingText;
  }

  #updatePendingAccelerator() {
    if (this.#modifiers.size > 0)
      this.#pendingAccelerator = [...this.#modifiers].join('+') + '...';
    else
      this.#pendingAccelerator = null;
  }
}
