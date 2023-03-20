import gui from 'gui';
import * as singleInstance from './util/single-instance';

// Check if it is Yode.
if (!process.versions.yode)
  throw new Error('Can only run under Yode runtime.');

if (process.platform == 'darwin') {
  gui.lifetime.onReady = main;
} else {
  if (singleInstance.quickCheckSync())
    checkSingleInstanceAndStart();
  else
    main();
}

function main() {
  // Create global controllers.
  require('./controller/api-manager');

  // Read configurations.
  const {config} = require('./controller/config-store');
  config.init();

  // Enable GC helper.
  require('./util/gc');

  // Capture all errors if succeeded to start.
  require('./util/capture-errors');

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
  main();
}
