import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import BaseView, {ViewState} from '../view/base-view';
import WebAPI from '../model/web-api';
import WebService from '../model/web-service';
import basicStyle from '../view/basic-style';

let resizeCursor: gui.Cursor;

export const resizeHandleWidth = 6;

export interface SplitViewState extends ViewState {
  panelWidth?: number;
}

export default abstract class SplitView<T extends WebService<WebAPI>> extends BaseView<T> {
  panel: AppearanceAware;
  mainView: BaseView;

  #inner: gui.Container;
  #resizeHandle: gui.Container;
  #resizeOrigin?: {x: number, width: number};

  constructor() {
    super();
    this.view.setStyle({flexDirection: 'row'});

    this.panel = new AppearanceAware();
    this.panel.view.setStyle({flexDirection: 'row', width: 200});
    this.view.addChildView(this.panel.view);

    this.#inner = gui.Container.create();
    this.#inner.setStyle({flex: 1});
    this.panel.view.addChildView(this.#inner);

    this.#resizeHandle = gui.Container.create();
    // The resize handle is transparent, so it can not be "seen", but if user
    // trys to resize the sidebar, they will find it.
    this.#resizeHandle.setStyle({width: resizeHandleWidth});
    this.#resizeHandle.setMouseDownCanMoveWindow(false);
    if (!resizeCursor)
      resizeCursor = gui.Cursor.createWithType('resize-ew');
    this.#resizeHandle.setCursor(resizeCursor);
    this.#resizeHandle.onMouseDown = (view, event) => {
      this.#resizeOrigin = {
        x: event.positionInWindow.x,
        width: this.getPanelWidth(),
      };
    };
    this.#resizeHandle.onMouseUp = () => this.#resizeOrigin = null;
    this.#resizeHandle.onMouseMove = this.#onDragHandle.bind(this);
    this.panel.view.addChildView(this.#resizeHandle);
  }

  destructor() {
    super.destructor();
    this.panel.destructor();
    this.mainView.destructor();
  }

  onFocus() {
    this.mainView.onFocus();
  }

  saveState(): SplitViewState {
    return {panelWidth: this.getPanelWidth()};
  }

  restoreState(state?: SplitViewState) {
    if (state?.panelWidth)
      this.panel.view.setStyle({width: state.panelWidth});
  }

  getMainView() {
    return this.mainView;
  }

  getMainViewSize(): gui.SizeF {
    return this.mainView.view.getBounds();
  }

  getSizeFromMainViewSize(size: gui.SizeF) {
    size.width += this.getPanelWidth();
    return size;
  }

  onResize() {
    // Subclass should override to do updating.
  }

  setMainView(view: BaseView) {
    if (this.mainView)
      throw new Error('setMainView can only be called once.');
    this.mainView = view;
    this.mainView.view.setStyle({flex: 1});
    this.view.addChildView(this.mainView.view);
  }

  addToPanel(view: gui.View) {
    view.setStyle({
      margin: basicStyle.padding,
      marginRight: basicStyle.padding - resizeHandleWidth,
    });
    this.#inner.addChildView(view);
  }

  getPanelWidth() {
    return this.panel.view.getBounds().width;
  }

  #onDragHandle(view, event) {
    if (!this.#resizeOrigin)
      return;
    const max = this.view.getBounds().width - 100;
    const width = Math.floor(Math.min(max, Math.max(100, event.positionInWindow.x - this.#resizeOrigin.x + this.#resizeOrigin.width)));
    this.panel.view.setStyle({width});
    this.onResize();
  }
}
