import gui from 'gui';

import NewAssistantWindow from './view/new-assistant-window';
import DashboardWindow from './view/dashboard-window';
import SettingsWindow from './view/settings-window';
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

  // Register named windows.
  windowManager.registerNamedWindow('dashboard', DashboardWindow);
  windowManager.registerNamedWindow('settings', SettingsWindow);
  windowManager.registerNamedWindow('newAssistant', NewAssistantWindow);

  // Restore window states from config.
  windowConfig.addItem('windows', windowManager);
  windowConfig.initFromFileSync();

  if (process.platform == 'darwin')
    gui.lifetime.onActivate = () => windowManager.showNamedWindow('dashboard');

  setQuitOnException(false);

  // After a successful start, we want to write current state into file.
  config.saveToFile();
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
