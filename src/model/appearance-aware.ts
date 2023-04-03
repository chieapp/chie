import gui from 'gui';
import SignalsOwner from '../model/signals-owner';

export default class AppearanceAware extends SignalsOwner {
  darkMode = false;
  view: gui.Container;

  constructor() {
    super();

    this.view = gui.Container.create();
    this.darkMode = gui.appearance.isDarkScheme();
    this.connectYueSignal(
      gui.appearance.onColorSchemeChange,
      this.onColorSchemeChange.bind(this));
  }

  protected onColorSchemeChange() {
    this.darkMode = gui.appearance.isDarkScheme();
    this.view.schedulePaint();
  }
}
