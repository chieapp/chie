import gui from 'gui';
import {Signal} from 'typed-signals';

import AppearanceAware from '../view/appearance-aware';
import Clickable from '../view/clickable';

interface SortableListOptions {
  padding: number;
}

interface Draggable extends Clickable {
  isDragging?: boolean;
}

export default class SortableList extends AppearanceAware {
  items: Clickable[] = [];
  padding: number;

  onReorder: Signal<(fromIndex: number, toIndex:number) => void> = new Signal;

  #originY?: number;  // used for computing mouse movement delta
  #maxY?: number;  // the y of last item
  #itemsY?: number[];  // the y of all items
  #originIndex?: number;  // original index of the item being dragged
  #draggingIndex?: number;  // current index of the item being dragged
  #placeholder?: gui.Container;  // placeholder view

  constructor({padding}: SortableListOptions) {
    super();
    this.padding = padding;
    this.view.setStyle({alignItems: 'center'});
  }

  destructor() {
    super.destructor();
    for (const item of this.items)
      item.destructor();
  }

  addItemAt(item: Clickable, index: number) {
    if (index < 0)
      index += this.view.childCount();
    item.view.setStyle({marginTop: this.padding});
    this.view.addChildViewAt(item.view, index);
    this.items.splice(index, 0, item);
    item.view.onMouseMove = this.#onDrag.bind(this, item);
    item.onMouseUp = this.#onDragEnd.bind(this, item);
  }

  removeItem(item: Clickable) {
    const index = this.items.indexOf(item);
    if (index == -1)
      throw new Error('Can not find the view to remove.');
    this.items.splice(index, 1);
    this.view.removeChildView(item.view);
    item.destructor();
  }

  reorderItem(fromIndex: number, toIndex: number) {
    const [item] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, item);
    this.view.removeChildView(item.view);
    this.view.addChildViewAt(item.view, toIndex);
  }

  #onDragStart(item: Draggable, view: gui.View, event: gui.MouseEvent) {
    item.isDragging = true;
    this.#itemsY = this.items.map(item => item.view.getBounds().y);
    this.#maxY = this.#itemsY[this.#itemsY.length - 1];
    // Make the item float for dragging.
    const bounds = view.getBounds();
    this.#originY = bounds.y - event.positionInWindow.y;
    view.setStyle({
      left: bounds.x,
      top: bounds.y,
      marginTop: 0,
      position: 'absolute',
    });
    // Add a fake item to take the original item's position, so other items
    // will stay where they are.
    this.#placeholder = gui.Container.create();
    this.#placeholder.setStyle({
      marginTop: this.padding,
      width: bounds.width,
      height: bounds.height,
    });
    this.#originIndex = this.#draggingIndex = this.items.indexOf(item);
    this.view.addChildViewAt(this.#placeholder, this.#draggingIndex);
  }

  #onDrag(item: Draggable, view: gui.View, event: gui.MouseEvent) {
    if (!item.pressed)
      return false;
    if (!item.isDragging) {  // first drag event
      this.#onDragStart(item, view, event);
      return true;
    }
    // Move the item based on mouse movement delta.
    let top = Math.floor(this.#originY + event.positionInWindow.y);
    top = Math.min(Math.max(top, -this.padding), this.#maxY + this.padding);
    view.setStyle({top});
    // Compute the target index.
    let index = this.#draggingIndex;
    const bottom = top + view.getBounds().height;
    for (let i = this.#itemsY.length - 1; i >= 0; --i) {
      if (bottom >= this.#itemsY[i]) {
        index = i;
        break;
      }
    }
    // Move the placeholder.
    if (this.#draggingIndex != index) {
      this.#draggingIndex = index;
      this.view.removeChildView(this.#placeholder);
      if (index > this.#originIndex)
        index += 1;
      this.view.addChildViewAt(this.#placeholder, index);
    }
    return true;
  }

  #onDragEnd(item: Draggable, view: gui.View) {
    if (!item.isDragging)
      return false;
    delete item.isDragging;
    view.setStyle({
      left: 0,
      top: 0,
      marginTop: this.padding,
      position: 'relative',
    });
    // Remove placeholder item.
    this.view.removeChildView(this.#placeholder);
    // Reorder.
    if (this.#draggingIndex != this.#originIndex)
      this.onReorder.emit(this.#originIndex, this.#draggingIndex);
    return true;
  }
}
