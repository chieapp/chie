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
    const sourceRootDir = path.resolve(__dirname, '..', '..');
    const exportsDir = path.resolve(__dirname, '..', 'exports');
    // Override how Node searches modules.
    const nodeModulePaths = Module['_nodeModulePaths'];
    Module['_nodeModulePaths'] = function(p) {
      const fromNodeModule = p.indexOf('node_modules') > -1;
      const fromInternal = p.startsWith(sourceRootDir + path.sep);
      const paths = nodeModulePaths.call(this, p)
        .filter(mp => {
          if (fromInternal) {
            // Avoid using modules from outside the app bundle.
            if (!mp.startsWith(sourceRootDir))
              return false;
          }
          return true;
        });
      // Make it possible to do require('chie') when request does not come from
      // a npm module.
      if (!fromNodeModule) {
        // For extensions the exportsDir is preferred, while for inside app
        // bundle it is used as last resort. This is to make require('gui') use
        // the actual module inside app bundle, and use the fake one in the
        // extensions.
        if (fromInternal)
          paths.push(exportsDir);
        else
          paths.unshift(exportsDir);
      }
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
