import gui from 'gui';
import AppearanceAware from '../view/appearance-aware';

export default abstract class Clickable extends AppearanceAware {
  // Events.
  onClick?: () => void;
  onContextMenu?: () => void;
  onMouseUp?: (view: gui.View, event: gui.MouseEvent) => boolean;

  // States.
  hover = false;
  pressed = false;
  enabled = true;

  constructor() {
    super();

    this.view.setMouseDownCanMoveWindow(false);
    this.view.onDraw = this.onDraw.bind(this);
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
      return true;
    };
    this.view.onMouseUp = (view, event) => {
      if (this.onMouseUp && this.onMouseUp(view, event))
        return true;
      this.pressed = false;
      this.view.schedulePaint();
      const bounds = view.getBounds();
      const pos = event.positionInView;
      if (pos.x < 0 || pos.y < 0 || pos.x > bounds.width || pos.y > bounds.height)
        return false;
      if (!this.enabled)
        return false;
      if (event.button == 1 && this.onClick)
        this.onClick();
      else if (event.button == 2 && this.onContextMenu)
        this.onContextMenu();
      return true;
    };
  }

  setEnabled(enabled: boolean) {
    if (this.enabled == enabled)
      return;
    this.enabled = enabled;
    this.view.schedulePaint();
  }

  abstract onDraw(view: gui.Container, painter: gui.Painter, dirty: gui.RectF);
}
