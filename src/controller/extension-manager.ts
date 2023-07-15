import fs from 'node:fs';
import path from 'node:path';
import {Module} from 'node:module';
import {Signal} from 'typed-signals';

import Extension from '../model/extension';
import {ConfigStoreItem} from '../model/config-store';

type ExtensionManagerData = Record<string, {dirPath: string}>;

export class ExtensionManager extends ConfigStoreItem {
  onAddExtension: Signal<(extension: Extension) => void> = new Signal();
  onRemoveExtension: Signal<(extension: Extension) => void> = new Signal();

  #extensions: Record<string, Extension> = {};

  constructor() {
    super();
    const sourceRootDir = path.resolve(__dirname, '..', '..');
    const exportsDir = path.resolve(__dirname, '..', 'exports');
    // Override how Node searches modules.
    const nodeModulePaths = Module['_nodeModulePaths'];
    Module['_nodeModulePaths'] = function(p) {
      const nodeModulesIndex = p.indexOf('node_modules');
      const fromNodeModule = nodeModulesIndex > -1 && nodeModulesIndex > sourceRootDir.length;
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

  deserialize(data: ExtensionManagerData) {
    this.activateBuiltinExtensions();
    for (const name in data)
      this.registerExternalExtension(data[name].dirPath);
  }

  serialize() {
    const data: ExtensionManagerData = {};
    for (const name in this.#extensions)
      data[name] = {dirPath: this.#extensions[name].dirPath};
    return data;
  }

  // Load builtin extensions.
  activateBuiltinExtensions() {
    const extensionsDir = path.join(__dirname, '..', 'extensions');
    const extensions = fs.readdirSync(extensionsDir);
    for (const name of extensions)
      require(path.join(extensionsDir, name)).activate();
  }

  registerExternalExtension(dirPath: string) {
    // Check for duplicate extensions.
    const packageJson = require(path.join(dirPath, 'package.json'));
    if (packageJson.name in this.#extensions)
      throw new Error(`Extension with name "${packageJson.name}" has been already registered.`);
    // Try loading the extension.
    require(dirPath).activate();
    // Read package and add to records.
    const extension = {
      name: packageJson.name,
      displayName: packageJson.displayName ?? packageJson.name,
      dirPath,
    };
    this.#extensions[packageJson.name] = extension;
    // Emit event.
    this.onAddExtension.emit(extension);
    this.saveConfig();
  }

  unregisterExternalExtension(name: string) {
    const extension = this.#extensions[name];
    if (!extension)
      throw new Error(`There is no extension named "${name}".`);
    require(extension.dirPath).deactivate();
    delete this.#extensions[name];
    this.onRemoveExtension.emit(extension);
    this.saveConfig();
  }

  getExtensions() {
    return Object.values(this.#extensions);
  }
}

export default new ExtensionManager;
