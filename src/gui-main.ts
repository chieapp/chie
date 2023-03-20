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
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
