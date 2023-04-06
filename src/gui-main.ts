import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';

import AppMenu from './view/app-menu';
import ChatWindow from './view/chat-window';
import main from './main';
import serviceManager from './controller/service-manager';
import * as singleInstance from './util/single-instance';

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

  const instance = serviceManager.getInstances()[0];
  const win = new ChatWindow(instance);
  global.win = win;
  if (process.platform == 'darwin') {
    const appMenu = new AppMenu();
    gui.app.setApplicationMenu(appMenu.menu);
  }
  win.window.onClose = () => {
    if (process.platform != 'darwin') {
      if (gui.MessageLoop.quit)
        gui.MessageLoop.quit();
      process.exit(0);
    }
  };

  const trayImage = gui.Image.createFromPath(fs.realpathSync(path.join(__dirname, '../assets/icons/tray@2x.png')));
  if (process.platform == 'darwin')
    trayImage.setTemplate(true);
  const tray = gui.Tray.createWithImage(trayImage);
  global.tray = tray;
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
