import gui from 'gui';
import path from 'node:path';
import {realpathSync} from 'node:fs';

export default class Icon {
  static builtinIconsPath = realpathSync(path.join(__dirname, '../../assets/icons'));

  readonly filePath: string;

  #chieUrl?: string;
  #image?: gui.Image;

  constructor(options: {filePath?: string, name?: string}) {
    if (options.filePath)
      this.filePath = options.filePath;
    else if (options.name)
      this.filePath = path.join(Icon.builtinIconsPath, `${options.name}.png`);
    else
      throw new Error(`Invalid options to Icon: ${options}.`);
  }

  getChieUrl() {
    if (!this.#chieUrl) {
      if (this.filePath.startsWith(Icon.builtinIconsPath))
        this.#chieUrl = 'chie://app-file/assets/icons/' + this.filePath.substr(Icon.builtinIconsPath.length).replaceAll('\\', '/');
      else
        throw new Error('Can not convert arbitrary file path to chie url.');
    }
    return this.#chieUrl;
  }

  getImage() {
    if (!this.#image)
      this.#image = gui.Image.createFromPath(this.filePath);
    return this.#image;
  }
}
