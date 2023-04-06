import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const CONFIG_VERSION = 1;

export interface ConfigStoreItem {
  deserialize(config: object): void;
  serialize(): object;
}

export class ConfigStore implements ConfigStoreItem {
  items: Record<string, ConfigStoreItem> = {};
  inMemory = false;

  #dir: string;
  #file: string;

  constructor(name: string) {
    this.#dir = getConfigDir(require('../../package.json').build.productName);
    this.#file = path.join(this.#dir, `${name}.json`);
  }

  initFromFile() {
    // Read config file.
    let config = {version: CONFIG_VERSION};
    try {
      config = fs.readJsonSync(this.#file);
    } catch (e) {
      if (e.code != 'ENOENT') // ignore file not exist error
        throw e;
    }
    this.deserialize(config);
  }

  deserialize(config) {
    // Check version.
    if (config.version && config.version > CONFIG_VERSION)
      throw new Error('Can not read config created by later versions');
    // Parse.
    for (const key in this.items)
      this.items[key].deserialize(config[key]);
  }

  serialize() {
    const config = {version: CONFIG_VERSION};
    for (const key in this.items)
      config[key] = this.items[key].serialize();
    if (!this.inMemory) {
      fs.ensureDirSync(this.#dir);
      fs.writeJsonSync(this.#file, config, {spaces: 2});
    }
    return config;
  }
}

// The global config.
export const config = new ConfigStore('config');

function getConfigDir(name) {
  switch (process.platform) {
    case 'win32':
      if (process.env.APPDATA)
        return path.join(process.env.APPDATA, name);
      else
        return path.join(os.homedir(), 'AppData', 'Roaming', name);
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', name);
    case 'linux':
      if (process.env.XDG_CONFIG_HOME)
        return path.join(process.env.XDG_CONFIG_HOME, name);
      else
        return path.join(os.homedir(), '.config', name);
    default:
      throw new Error('Unknown platform');
  }
}
