import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';

import {config} from './configs';

export class HistoryKeeper {
  dir: string;

  constructor() {
    this.dir = path.join(config.dir, 'history');
  }

  newMoment() {
    return crypto.randomUUID();
  }

  async remember(moment: string) {
    try {
      return await fs.readJson(this.getFilePath(moment));
    } catch (error) {
      if (error.code != 'ENOENT')  // ignore file not exist error
        throw error;
      return {};
    }
  }

  async save(moment: string, memory: object) {
    if (!config.inMemory)
      await fs.outputJson(this.getFilePath(moment), memory, {spaces: 2});
  }

  async forget(moment: string) {
    try {
      await fs.remove(this.getFilePath(moment));
    } catch (error) {
      if (error.code != 'ENOENT')  // ignore file not exist error
        throw error;
    }
  }

  getFilePath(moment: string) {
    return path.join(this.dir, moment + '.json');
  }
}

export default new HistoryKeeper();
