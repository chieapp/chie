import gui from 'gui';
import SignalsOwner from '../model/signals-owner';

export default class AppearanceAware extends SignalsOwner {
  view: gui.Container;
  darkMode = false;
  backgroundColor?: {light: string, dark: string};

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
    if (this.backgroundColor)
      this.view.setBackgroundColor(this.darkMode ? this.backgroundColor.dark : this.backgroundColor.light);
    this.view.schedulePaint();
  }

  setBackgroundColor(light: string, dark: string) {
    this.view.setBackgroundColor(this.darkMode ? dark : light);
    this.backgroundColor = {light, dark};
  }
}
