import fs from 'node:fs';
import path from 'node:path';
import {Module} from 'node:module';

type Extension = {
  activate(): void;
};

export class ExtensionManager {
  #builtinExtensions: Extension[] = [];

  constructor() {
    // Make it possible to do require('chie').
    const nodeModulePaths = Module['_nodeModulePaths'];
    Module['_nodeModulePaths'] = function(p) {
      const paths = nodeModulePaths.call(this, p);
      if (p.indexOf('node_modules') === -1)
        return paths.concat(path.join(__dirname, '..', 'exports'));
      return paths;
    };

    // Load builtin extensions.
    const extensionsDir = path.join(__dirname, '..', 'builtin-extensions');
    const extensions = fs.readdirSync(extensionsDir);
    for (const name of extensions)
      this.#builtinExtensions.push(require(path.join(extensionsDir, name)));
  }

  // Activate extensions.
  activate() {
    for (const extension of this.#builtinExtensions)
      extension.activate();
  }
}

export default new ExtensionManager;
