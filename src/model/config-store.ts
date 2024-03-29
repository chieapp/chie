import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import AtomicWriter from '../util/atomic-writer';

const CONFIG_VERSION = 1;

export abstract class ConfigStoreItem {
  store?: ConfigStore;

  abstract deserialize(config: object): void;
  abstract serialize(): object;

  saveConfig() {
    return this.store?.saveToFile();
  }
}

export default class ConfigStore extends ConfigStoreItem {
  inMemory = false;
  initialized = false;
  #items: Record<string, ConfigStoreItem> = {};

  dir: string;
  #file: string;
  #writer: AtomicWriter;

  constructor(name: string) {
    super();
    this.dir = getConfigDir(require('../../package.json').build.productName);
    this.#file = path.join(this.dir, `${name}.json`);
    this.#writer = new AtomicWriter(this.#file);
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
    this.initialized = true;
  }

  async saveToFile() {
    if (this.inMemory || !this.initialized)
      return;
    await this.#writer.write(JSON.stringify(this.serialize(), null, 2));
  }

  addItem(key: string, item: ConfigStoreItem) {
    if (key in this.#items)
      throw new Error(`Key "${key}" already exists.`);
    if (item.store)
      throw new Error('Item has already been added to a ConfigStore');
    item.store = this;
    this.#items[key] = item;
  }
}

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
