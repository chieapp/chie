import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';

import AppMenu from './view/app-menu';
import ChatService from './model/chat-service';
import ChatView from './view/chat-view';
import {ChatAPI} from './model/chat-api';
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

  let type = 'ChatGPT';
  if (process.argv.includes('--bingchat'))
    type = 'BingChat';
  const endpoint = apiManager.getEndpointsByType(type)[0];
  const api = apiManager.createAPIForEndpoint(endpoint);

  const win = gui.Window.create({});
  global.win = win;
  win.setContentSize({width: 400, height: 400});
  win.center();
  win.activate();

  if (process.platform == 'darwin') {
    const appMenu = new AppMenu();
    global.appMenu = appMenu;
    gui.app.setApplicationMenu(appMenu.menu);
  } else {
    const appMenu = new AppMenu(win);
    global.appMenu = appMenu;
    win.setMenuBar(appMenu.menu);
  }

  const service = new ChatService(api.endpoint.name, api as ChatAPI);
  const chatView = new ChatView(service);
  service.onTitle.connect((title) => win.setTitle(title));
  win.setContentView(chatView.view);

  win.onFocus = () => chatView.input.entry.focus();
  win.onClose = () => {
    chatView.unload();
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
