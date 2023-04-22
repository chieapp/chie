import gui from 'gui';

import NewAPIWindow from './view/new-api-window';
import NewAssistantWindow from './view/new-assistant-window';
import DashboardWindow from './view/dashboard-window';
import SettingsWindow from './view/settings-window';
import app from './controller/app';
import main from './main';
import windowManager from './controller/window-manager';
import * as singleInstance from './util/single-instance';
import {config, windowConfig} from './controller/configs';
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

  // Trays and app menus.
  config.addItem('app', app);
  config.initFromFileSync();

  // Register named windows.
  windowManager.registerNamedWindow('dashboard', DashboardWindow);
  windowManager.registerNamedWindow('settings', SettingsWindow);
  windowManager.registerNamedWindow('newAssistant', NewAssistantWindow);
  windowManager.registerNamedWindow('newAPI', NewAPIWindow);

  // Restore window states from config.
  windowConfig.addItem('windows', windowManager);
  windowConfig.initFromFileSync();

  // When there is no window available, clicking on the dock icon should show
  // the dashboard window.
  if (process.platform == 'darwin')
    gui.lifetime.onActivate = () => windowManager.showNamedWindow('dashboard');

  // After windows are initialized, all errors happened later are usually not
  // critical and we do not need to quit.
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
