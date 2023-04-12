import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const CONFIG_VERSION = 1;

export interface ConfigStoreItem {
  deserialize(config: object): void;
  serialize(): object;
}

export class ConfigStore implements ConfigStoreItem {
  inMemory = false;
  #items: Record<string, ConfigStoreItem> = {};

  dir: string;
  #file: string;

  constructor(name: string) {
    this.dir = getConfigDir(require('../../package.json').build.productName);
    this.#file = path.join(this.dir, `${name}.json`);
  }

  deserialize(config) {
    // Check version.
    if (config.version && config.version > CONFIG_VERSION)
      throw new Error('Can not read config created by later versions');
    // Parse.
    for (const key in this.#items)
      this.#items[key].deserialize(config[key]);
  }

  serialize() {
    const config = {version: CONFIG_VERSION};
    for (const key in this.#items)
      config[key] = this.#items[key].serialize();
    return config;
  }

  initFromFileSync() {
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

  async saveToFile() {
    if (!this.inMemory)
      await fs.outputJson(this.#file, this.serialize(), {spaces: 2});
  }

  addItem(key: string, item: ConfigStoreItem) {
    if (key in this.#items)
      throw new Error(`Key "${key}" already exists.`);
    this.#items[key] = item;
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
