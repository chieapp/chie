import fs from 'node:fs';
import path from 'node:path';
import {Module} from 'node:module';

import {getNextId} from '../util/id-generator';

interface ExtensionRecord {
  name: string;
  displayName: string;
  path: string;
}

export class ExtensionManager {
  #extensions: Record<string, ExtensionRecord> = {};

  constructor() {
    // Make it possible to do require('chie').
    const nodeModulePaths = Module['_nodeModulePaths'];
    Module['_nodeModulePaths'] = function(p) {
      const paths = nodeModulePaths.call(this, p);
      if (p.indexOf('node_modules') === -1)
        return paths.concat(path.join(__dirname, '..', 'exports'));
      return paths;
    };
  }

  // Activate extensions.
  activate() {
    // Load builtin extensions.
    const extensionsDir = path.join(__dirname, '..', 'extensions');
    const extensions = fs.readdirSync(extensionsDir);
    for (const name of extensions)
      require(path.join(extensionsDir, name)).activate();
    // Load third party extensions.
    for (const id in this.#extensions)
      require(this.#extensions[id].path).activate();
  }

  registerExternalExtension(dirPath: string) {
    // Read package and add to records.
    const packageJson = require(path.join(dirPath, 'package.json'));
    const id = getNextId(packageJson.name, Object.keys(this.#extensions));
    this.#extensions[id] = {
      name: packageJson.name,
      displayName: packageJson.displayName ?? packageJson.name,
      path: dirPath,
    };
    return id;
  }
}

export default new ExtensionManager;
