import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';

import {APIEndpointType} from './model/api-endpoint';
import ChatView from './view/chat-view';
import ChatGPTService from './service/chatgpt/chatgpt-service';
import main from './main';
import apiManager from './controller/api-manager';
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
  global.win = win;
  win.setContentSize({width: 400, height: 400});
  win.center();
  win.activate();
  win.onClose = process.exit;

  const endpoint = apiManager.getEndpointsByType(APIEndpointType.ChatGPT)[0];
  const chatView = new ChatView(new ChatGPTService(endpoint));
  win.setContentView(chatView.view);

  const p = fs.realpathSync(path.join(__dirname, '../assets/view/BlackWhiteTrayTemplate@2x.png'));
  const tray = gui.Tray.createWithImage(gui.Image.createFromPath(p));
  global.tray = tray;
}

async function checkSingleInstanceAndStart() {
  if (await singleInstance.check()) {
    gui.MessageLoop.quit();
    process.exit(0);
  }
  guiMain();
}
