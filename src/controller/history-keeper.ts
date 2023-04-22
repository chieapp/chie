import Queue from 'queue';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';

import {config} from './configs';

export class HistoryKeeper {
  dir: string;
  #queue: Queue;

  constructor() {
    this.dir = path.join(config.dir, 'history');
    // When sending messages it may happen we write to one file with different
    // content at the same time, putting the writes in a seqeuence solves write
    // conflicts. It also improves user experience since we don't want to do
    // too much writes at the same time.
    this.#queue = new Queue({concurrency: 1, autostart: true});
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

  save(moment: string, memory: object) {
    if (config.inMemory)
      return;
    this.#queue.push(() => fs.outputJson(this.getFilePath(moment), memory));
  }

  flush() {
    if (this.#queue.length == 0)
      return;
    return new Promise<void>(resolve => this.#queue.once('end', resolve));
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
