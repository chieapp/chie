import gui from 'gui';
import path from 'node:path';
import {config} from '../controller/configs';
import {realpathSync} from 'node:fs';

export default class Icon {
  static builtinIconsPath = path.resolve(__dirname, '../../assets/icons');
  static userIconsPath = path.resolve(config.dir, 'icons');

  readonly filePath: string;

  #chieURL?: string;
  #image?: gui.Image;

  constructor(options: {chieURL?: string, image?: gui.Image, filePath?: string, name?: string}) {
    if (options.chieURL) {
      const u = new URL(options.chieURL);
      if (u.host == 'app-file')
        this.filePath = path.join(__dirname, `../../${u.pathname}`);
      else if (u.host == 'user-icon')
        this.filePath = path.join(Icon.userIconsPath, u.pathname);
      else
        throw new Error(`Invalid chie URL: ${options.chieURL}`);
      this.#chieURL = options.chieURL;
    } else if (options.image) {
      if (!options.filePath)
        throw new Error('Must specify filePath when passing image to icon.');
      this.#image = options.image;
      this.filePath = options.filePath;
    } else if (options.filePath) {
      this.filePath = options.filePath;
    } else if (options.name) {
      this.filePath = path.join(Icon.builtinIconsPath, `${options.name}.png`);
    } else {
      throw new Error(`Invalid options to Icon: ${options}.`);
    }
  }

  getChieURL() {
    if (!this.#chieURL) {
      if (this.filePath.startsWith(Icon.builtinIconsPath))
        this.#chieURL = 'chie://app-file/assets/icons' + this.filePath.substr(Icon.builtinIconsPath.length).replaceAll('\\', '/');
      else if (this.filePath.startsWith(Icon.userIconsPath))
        this.#chieURL = 'chie://user-icon' + this.filePath.substr(Icon.userIconsPath.length).replaceAll('\\', '/');
      else
        throw new Error('Can not convert arbitrary file path to chie url.');
    }
    return this.#chieURL;
  }

  getImage() {
    if (!this.#image)
      this.#image = gui.Image.createFromPath(realpathSync(this.filePath));
    return this.#image;
  }
}
