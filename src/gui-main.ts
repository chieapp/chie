import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';

import main from './main';
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

  const win = gui.Window.create({});
  win.setContentSize({width: 100, height: 100});
  win.center();
  win.activate();
  win.onClose = process.exit;

  const p = fs.realpathSync(path.join(__dirname, '../assets/BlackWhiteTrayTemplate@2x.png'));
  const tray = gui.Tray.createWithImage(gui.Image.createFromPath(p));

  global.win = win;
  global.tray = tray;
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
