import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';

import main from './main';
import windowManager from './controller/window-manager';
import * as singleInstance from './util/single-instance';
import {config, windowConfig} from './controller/config-store';
import {setQuitOnException} from './controller/exception-handler';

// Check if it is Yode.
if (!process.versions.yode)
  throw new Error('Can only run under Yode runtime.');

if (process.platform == 'darwin') {
  gui.lifetime.onReady = guiMain;
} else {
  if (singleInstance.quickCheckSync())
    checkSingleInstanceAndStart();
  else
    guiMain();
}

function guiMain() {
  main();

  windowConfig.addItem('windows', windowManager);
  windowConfig.initFromFileSync();

  if (process.platform != 'darwin')
    windowManager.getDashboard().window.activate();

  const trayImage = gui.Image.createFromPath(fs.realpathSync(path.join(__dirname, '../assets/icons/tray@2x.png')));
  if (process.platform == 'darwin')
    trayImage.setTemplate(true);
  const tray = gui.Tray.createWithImage(trayImage);
  global.tray = tray;

  setQuitOnException(false);

  // After successful start, we want to write current state into file.
  config.saveToFile();
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
